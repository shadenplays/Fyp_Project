// src/App.js
import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

import DashboardPage from "./components/DashboardPage";
import ProductPage from "./components/ProductPage";
import HistoryPage from "./components/HistoryPage";
import ProfilePage from "./components/ProfilePage";
import SettingsPage from "./components/SettingsPage";
import LoginPage from "./components/LoginPage";

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  // ✅ SHIFT STATE
  const [currentShift, setCurrentShift] = useState("");

  // ✅ Malaysia time helper
  const getMalaysiaNow = () => {
    const str = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kuala_Lumpur",
    });
    return new Date(str);
  };

  // ✅ Shift logic
  const getCurrentShift = () => {
    const hour = getMalaysiaNow().getHours();
    return hour >= 7 && hour < 19 ? "DAY SHIFT" : "NIGHT SHIFT";
  };

  // ✅ Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const userDoc = await getDoc(doc(db, "testers", firebaseUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({
              name: firebaseUser.displayName || "User",
              email: firebaseUser.email,
              role: "user",
            });
          }
        } catch {
          setUserData({
            name: firebaseUser.displayName || "User",
            email: firebaseUser.email,
            role: "user",
          });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Initialize & auto-update shift
  useEffect(() => {
    setCurrentShift(getCurrentShift());

    const interval = setInterval(() => {
      setCurrentShift(getCurrentShift());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "product":
        return <ProductPage />;
      case "history":
        return <HistoryPage />;
      case "profile":
        return <ProfilePage user={user} userData={userData} />;
      case "settings":
        return userData?.role === "admin" ? <SettingsPage /> : <DashboardPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="user-card">
          <div className="user-header">
            <div className="user-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c4dff" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="user-info">
              <div className="user-name">{userData?.name || user.displayName || "User"}</div>
              <div className="user-ip">IP: {userData?.ip || "N/A"}</div>
            </div>
          </div>
          <div className="user-badge">{userData?.role === "admin" ? "Admin" : "User"}</div>
        </div>

        <nav className="nav-menu">
          <NavItem icon="📊" label="Dashboard" active={activePage === "dashboard"} onClick={() => setActivePage("dashboard")} />
          <NavItem icon="📦" label="Product" active={activePage === "product"} onClick={() => setActivePage("product")} />
          <NavItem icon="🕐" label="History" active={activePage === "history"} onClick={() => setActivePage("history")} />
          <NavItem icon="👤" label="Profile" active={activePage === "profile"} onClick={() => setActivePage("profile")} />
          {userData?.role === "admin" && (
            <NavItem icon="⚙️" label="Settings" active={activePage === "settings"} onClick={() => setActivePage("settings")} />
          )}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          LOGOUT <span>🚪</span>
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="header">
          <h1>Status Dashboard</h1>

          <div className="shift-info">
            <div className="shift-label">Current On Shift</div>

            <div className={`shift-badge ${currentShift === "DAY SHIFT" ? "day" : "night"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#7c4dff">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>

              <span>{currentShift}</span>
            </div>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default App;