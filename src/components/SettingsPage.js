// src/components/SettingsPage.js
import React, { useEffect, useState } from "react";
import {
  collection, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";

function SettingsPage() {
  const [testers, setTesters] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", ip: "", password: "" });
  const [message, setMessage] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null); // stores form data while waiting for admin password

  // ✅ Save admin email on mount
  useEffect(() => {
    if (auth.currentUser) {
      setAdminEmail(auth.currentUser.email);
    }
  }, []);

  const fetchTesters = async () => {
    try {
      const snapshot = await getDocs(collection(db, "testers"));
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTesters(data);
    } catch (err) {
      console.error("Error fetching testers:", err);
    }
  };

  useEffect(() => {
    fetchTesters();
  }, []);

  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  // ✅ Step 1: Validate form and ask for admin password BEFORE creating user
  const handleAdd = () => {
    if (!form.name || !form.email || !form.password) {
      return notify("Name, email, and password are required");
    }
    if (form.password.length < 6) {
      return notify("Password must be at least 6 characters");
    }
    // Save form data and show admin password prompt
    setPendingAdd({ ...form });
    setAdminPassword("");
    setShowAdminPrompt(true);
  };

  // ✅ Step 2: Admin confirms password, THEN create tester, THEN sign back in immediately
  const handleConfirmAdd = async () => {
    if (!adminPassword) {
      return notify("Please enter your admin password");
    }

    setShowAdminPrompt(false);

    try {
      // Create Firebase Auth account for tester
      const userCred = await createUserWithEmailAndPassword(auth, pendingAdd.email, pendingAdd.password);
      await updateProfile(userCred.user, { displayName: pendingAdd.name });
      const newUid = userCred.user.uid;

      // Save Firestore document
      await setDoc(doc(db, "testers", newUid), {
        name: pendingAdd.name,
        email: pendingAdd.email,
        ip: pendingAdd.ip || "",
        role: "user",
        createdAt: serverTimestamp()
      });

      // ✅ Immediately sign back in as admin using pre-entered password
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      notify("Tester added successfully!");
      fetchTesters();
      setForm({ name: "", email: "", ip: "", password: "" });
      setShowAddForm(false);
      setPendingAdd(null);
      setAdminPassword("");
    } catch (err) {
      // ✅ Try to sign back in as admin even if something failed
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (e) {
        console.error("Could not re-sign in as admin:", e);
      }

      if (err.code === "auth/email-already-in-use") {
        notify("This email already has an account");
      } else if (err.code === "auth/weak-password") {
        notify("Password must be at least 6 characters");
      } else {
        notify("Error adding tester: " + err.message);
      }
    }
  };

  // Upload CSV
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
    lines.shift();
    let added = 0;
    let skipped = 0;

    const currentAdminEmail = auth.currentUser?.email;

    for (const line of lines) {
      const cols = line.split(",").map(c => c.trim().replace(/\r/g, ""));
      if (cols.length >= 4 && cols[0] && cols[1] && cols[3]) {
        try {
          const userCred = await createUserWithEmailAndPassword(auth, cols[1], cols[3]);
          await updateProfile(userCred.user, { displayName: cols[0] });
          await setDoc(doc(db, "testers", userCred.user.uid), {
            name: cols[0],
            email: cols[1],
            ip: cols[2] || "",
            role: "user",
            createdAt: serverTimestamp()
          });
          added++;
        } catch (err) {
          console.error("Error importing row:", err.message);
          skipped++;
        }
      }
    }

    const pwd = prompt(`Imported ${added} testers (${skipped} skipped). Enter admin password to sign back in:`);
    if (pwd) {
      await signInWithEmailAndPassword(auth, currentAdminEmail, pwd);
    }

    notify(`${added} testers imported, ${skipped} skipped`);
    fetchTesters();
    e.target.value = "";
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this tester?")) return;

    const tester = testers.find(t => t.id === docId);
    if (!tester) return notify("Tester not found");

    try {
      // Try to sign in as tester and delete their Auth account
      const testerPassword = prompt(`Enter password for ${tester.name} to fully remove their login access (or press Cancel to delete profile only):`);

      if (testerPassword) {
        try {
          const testerCred = await signInWithEmailAndPassword(auth, tester.email, testerPassword);
          await testerCred.user.delete();
          // Sign back in as admin
          const ap = prompt("Enter YOUR admin password to sign back in:");
          if (ap) await signInWithEmailAndPassword(auth, adminEmail, ap);
        } catch (authErr) {
          console.warn("Auth deletion skipped:", authErr.message);
          // Still continue to delete Firestore doc even if Auth fails
          const ap = prompt("Could not remove login access. Enter admin password to continue:");
          if (ap) await signInWithEmailAndPassword(auth, adminEmail, ap);
        }
      }

      // Always delete Firestore doc regardless
      await deleteDoc(doc(db, "testers", docId));
      notify("Tester deleted");
      fetchTesters();

    } catch (err) {
      notify("Error deleting: " + err.message);
    }
  };

  const handleEdit = (tester) => {
    setEditTarget(tester.id);
    setForm({ name: tester.name, email: tester.email, ip: tester.ip || "", password: "" });
    setShowAddForm(false);
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, "testers", editTarget), {
        name: form.name,
        email: form.email,
        ip: form.ip
      });
      notify("Tester updated");
      fetchTesters();
      setEditTarget(null);
      setForm({ name: "", email: "", ip: "", password: "" });
    } catch (err) {
      notify("Error updating: " + err.message);
    }
  };

  return (
      <div className="page-content">
        <h2 className="page-title">Manage Testers (Admin)</h2>

        {message && (
            <div className="card" style={{ background: "#e0ffe0", color: "#007700", marginBottom: "1rem", padding: "0.75rem" }}>
              {message}
            </div>
        )}

        {/* ✅ Admin password prompt shown BEFORE creating user */}
        {showAdminPrompt && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.5)", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 9999
            }}>
              <div style={{ background: "#fff", padding: "2rem", borderRadius: "12px", width: "360px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
                <h3 style={{ marginBottom: "1rem", color: "#333" }}>Confirm Admin Password</h3>
                <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
                  Enter your admin password to confirm adding <strong>{pendingAdd?.name}</strong>.
                  You will be signed back in as admin automatically.
                </p>
                <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleConfirmAdd()}
                    placeholder="Your admin password"
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "1rem", fontSize: "1rem" }}
                    autoFocus
                />
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowAdminPrompt(false); setPendingAdd(null); }}
                          style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", background: "#aaa", color: "white", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleConfirmAdd}
                          style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "none", background: "#4CAF50", color: "white", cursor: "pointer", fontWeight: "bold" }}>
                    Confirm & Add Tester
                  </button>
                </div>
              </div>
            </div>
        )}

        <div className="card settings-card">
          <h3>Active Testers</h3>
          <p>Manage testers who have access to the testing system.</p>

          <div className="tester-list">
            {testers.map((tester) => (
                <div key={tester.id} className="tester-item">
                  {editTarget === tester.id ? (
                      <div style={{ display: "flex", gap: "0.5rem", flex: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" style={{ flex: 1, padding: "0.4rem" }} />
                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" style={{ flex: 1, padding: "0.4rem" }} />
                        <input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="IP Address" style={{ flex: 1, padding: "0.4rem" }} />
                        <button onClick={handleSaveEdit} style={{ background: "#4CAF50", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditTarget(null)} style={{ background: "#aaa", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                      </div>
                  ) : (
                      <>
                        <div className="tester-info">
                          <div className="tester-avatar"><i className="fas fa-user"></i></div>
                          <div className="tester-details">
                            <h3>{tester.name}</h3>
                            <p>{tester.email}</p>
                            <p style={{ fontSize: "0.8rem", color: "#888" }}>IP: {tester.ip || "Not set"}</p>
                          </div>
                        </div>
                        <div className="tester-actions">
                          <div className="action-btn edit-btn" onClick={() => handleEdit(tester)}><i className="fas fa-edit"></i></div>
                          <div className="action-btn delete-btn" onClick={() => handleDelete(tester.id)}><i className="fas fa-trash"></i></div>
                        </div>
                      </>
                  )}
                </div>
            ))}
          </div>

          {showAddForm && (
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }} />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email Address" style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }} />
                <input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="IP Address (e.g. 192.168.7.108)" style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }} />
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 6 chars)" style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }} />
                <button onClick={handleAdd} style={{ background: "#4CAF50", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>Save</button>
                <button onClick={() => setShowAddForm(false)} style={{ background: "#aaa", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
              </div>
          )}

          <div className="add-tester" style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1rem" }}>
            <button className="add-btn" onClick={() => { setShowAddForm(true); setEditTarget(null); setForm({ name: "", email: "", ip: "", password: "" }); }}>
              <i className="fas fa-plus"></i> Add New Tester
            </button>
            <label style={{ cursor: "pointer", background: "#5c6bc0", color: "white", padding: "0.5rem 1rem", borderRadius: "6px" }}>
              📂 Import CSV (name,email,ip,password)
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>
  );
}

export default SettingsPage;