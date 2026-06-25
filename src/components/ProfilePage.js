// src/components/ProfilePage.js
import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

function ProfilePage({ user, userData }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    ip: "",
    role: ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (userData) {
      setForm({
        name: userData.name || user?.displayName || "",
        email: userData.email || user?.email || "",
        ip: userData.ip || "",
        role: userData.role || "user"
      });
    }
  }, [userData, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "testers", user.uid), {
        name: form.name,
        ip: form.ip
      });
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage("Error updating profile: " + err.message);
    }
    setSaving(false);
  };

  return (
      <div className="page-content">
        <h2 className="page-title">User Profile</h2>
        <div className="card profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              <i className="fas fa-user"></i>
            </div>
            <div className="profile-info">
              <h2>{form.name}</h2>
              <p>{form.role}</p>
              <p>{form.email}</p>
            </div>
          </div>

          {message && (
              <div style={{ padding: "0.5rem 1rem", margin: "1rem 0", background: "#e0ffe0", color: "#007700", borderRadius: "6px" }}>
                {message}
              </div>
          )}

          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="email" value={form.email} disabled
                     style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>
            <div className="form-group">
              <label>IP Address</label>
              <input name="ip" value={form.ip} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input name="role" value={form.role} disabled
                     style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </div>

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={() => {
                setForm({
                  name: userData?.name || "",
                  email: userData?.email || "",
                  ip: userData?.ip || "",
                  role: userData?.role || "user"
                });
              }}>Cancel</button>
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}

export default ProfilePage;