// src/components/LoginPage.js
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

// Set this to the email you created for the admin account in Firebase Auth
const ADMIN_EMAIL = "admin@unitcheck.com"; // ← change this to your admin's email
const ADMIN_PASSWORD = "admin123";

function LoginPage() {
  const [ipAddress, setIpAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!ipAddress || !password) {
      setError("Please enter your IP and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Admin backdoor — any IP + "admin123"
      if (password === ADMIN_PASSWORD) {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        return; // onAuthStateChanged in App.js handles the rest
      }

      // Regular tester — look up email by IP in Firestore
      const q = query(collection(db, "testers"), where("ip", "==", ipAddress.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("No tester found with this IP address");
        setLoading(false);
        return;
      }

      const testerData = snapshot.docs[0].data();
      const testerEmail = testerData.email;

      // Sign in with the tester's email + the password they typed
      await signInWithEmailAndPassword(auth, testerEmail, password);
      // onAuthStateChanged in App.js handles the rest
    } catch (err) {
      switch (err.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Invalid IP or password");
          break;
        case "auth/user-not-found":
          setError("No account found for this tester");
          break;
        default:
          setError("Login failed. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
      <div className="login-container">
        <div className="login-box">
          <div className="logo">
            <div style={{
              width: "150px", height: "80px", background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "8px", fontSize: "16px", fontWeight: "bold",
              color: "#003366", margin: "0 auto"
            }}>
              Inari Amertron Berhad
            </div>
          </div>

          <div className="welcome-text">
            <i className="fas fa-network-wired"></i>
            <h3>IP Authentication</h3>
            <p>Enter your IP address and password</p>
          </div>

          <div className="form-group">
            <label>IP Address</label>
            <div className="input-with-icon">
              <i className="fas fa-network-wired"></i>
              <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.7.7"
                  onKeyPress={handleKeyPress}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <i className="fas fa-lock"></i>
              <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyPress={handleKeyPress}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>

          <button className="confirm-btn" onClick={handleLogin} disabled={loading}>
            {loading ? "Authenticating..." : "Authenticate"}
          </button>

        </div>
      </div>
  );
}

export default LoginPage;