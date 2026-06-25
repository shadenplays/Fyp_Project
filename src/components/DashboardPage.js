// src/components/DashboardPage.js
import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function DashboardPage() {
  const [results, setResults] = useState([]);

  // ✅ Auto detect shift
  const getCurrentShift = () => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? "day" : "night";
  };

  const [activeShift, setActiveShift] = useState(getCurrentShift());
  const [lastUpdated, setLastUpdated] = useState("");

  // ✅ Fetch data
  const fetchResults = async () => {
    try {
      const snapshot = await getDocs(collection(db, "testResults"));

      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setResults(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Error fetching results:", err);
    }
  };

  useEffect(() => {
    fetchResults();

    // ✅ Auto update shift every minute
    const interval = setInterval(() => {
      setActiveShift(getCurrentShift());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ✅ LOCAL DATE (not UTC)
  const getLocalDate = (date) => {
    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  const today = getLocalDate(new Date());

  const yesterdayDateObj = new Date(Date.now() - 86400000);

  const yesterday = getLocalDate(yesterdayDateObj);

  // ✅ Normalize timestamp
  const formatDate = (ts) => {
    if (!ts) return null;

    if (ts.seconds) {
      return getLocalDate(new Date(ts.seconds * 1000));
    }

    return getLocalDate(new Date(ts));
  };

  // ✅ Filter by date
  const todayResults = results.filter(
      (r) => formatDate(r.testTimestamp) === today
  );

  const yesterdayResults = results.filter(
      (r) => formatDate(r.testTimestamp) === yesterday
  );

  // ✅ NEW SHIFT FILTER LOGIC
  const filterByShift = (data) => {
    return data.filter((r) => {
      if (!r.testTimestamp) return false;

      const date = r.testTimestamp.seconds
          ? new Date(r.testTimestamp.seconds * 1000)
          : new Date(r.testTimestamp);

      const hour = date.getHours();

      // 🌞 DAY SHIFT → 7AM - 6:59PM
      if (activeShift === "day") {
        return hour >= 7 && hour < 19;
      }

      // 🌙 NIGHT SHIFT → 7PM - 6:59AM
      return hour >= 19 || hour < 7;
    });
  };

  // ✅ Apply shift filter
  const filteredTodayResults = filterByShift(todayResults);

  const filteredYesterdayResults = filterByShift(yesterdayResults);

  // ✅ Stats calculation
  const calculateStats = (data) => {
    const total = data.length;

    const pass = data.filter((t) => t.status === "PASS").length;

    return {
      passRate: total ? Math.round((pass / total) * 100) : 0,
      firstAttemptPass: total ? Math.round((pass / total) * 100) : 0,
      totalTests: total,
      productTested: total,
      failedTests: total - pass,
    };
  };

  // ✅ Use filtered data
  const todayStats = calculateStats(filteredTodayResults);

  const yesterdayStats = calculateStats(filteredYesterdayResults);

  // ✅ Display date/time
  const now = new Date();

  const dateStr = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const yesterdayDisplay = yesterdayDateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ✅ SORT latest first using FILTERED results
  const sortedResults = [...filteredTodayResults].sort((a, b) => {
    const getTime = (t) =>
        t?.seconds ? t.seconds * 1000 : new Date(t).getTime();

    return getTime(b.testTimestamp) - getTime(a.testTimestamp);
  });

  return (
      <>
        {/* ✅ SHIFT TOGGLE */}
        <div className="shift-toggle">
          <button
              className={activeShift === "day" ? "active" : ""}
              onClick={() => setActiveShift("day")}
          >
            ⭐ DAY SHIFT 7.00 a.m
          </button>

          <button
              className={activeShift === "night" ? "active night" : ""}
              onClick={() => setActiveShift("night")}
          >
            🌙 NIGHT SHIFT 7.00 pm
          </button>
        </div>

        {/* ✅ DATE & TIME */}
        <div className="date-time">
          <div>
            <div className="label">Date</div>
            <div className="value">{dateStr}</div>
          </div>

          <div>
            <div className="label">Time</div>
            <div className="value">{timeStr}</div>
          </div>
        </div>

        {/* ✅ STATS */}
        <div className="stats-grid">
          <StatsCard
              title={`TODAY (${activeShift.toUpperCase()} SHIFT)`}
              date={dateStr}
              stats={todayStats}
          />

          <StatsCard
              title={`YESTERDAY (${activeShift.toUpperCase()} SHIFT)`}
              date={yesterdayDisplay}
              stats={yesterdayStats}
              isYesterday
          />
        </div>

        {/* ✅ RECENT ACTIVITY */}
        <div className="activity-card">
          <div className="activity-header">
            <h2>Recent Activity</h2>

            <div className="activity-controls">
              <button className="refresh-btn" onClick={fetchResults}>
                🔄 Refresh
              </button>

              <span className="last-update">
              ⏰ Last updated: {lastUpdated}
            </span>
            </div>
          </div>

          <div className="activity-list">
            {sortedResults.length === 0 ? (
                <p style={{ color: "#888", padding: "1rem" }}>
                  No test results for this shift.
                </p>
            ) : (
                sortedResults.slice(0, 6).map((r) => (
                    <div key={r.id} className="activity-item">
                      <div className="activity-left">
                        <div className={`status-icon ${r.status?.toLowerCase()}`}>
                          {r.status === "PASS" ? "✓" : "✕"}
                        </div>

                        <div>
                          <div className="tester-id">{r.ip}</div>

                          <div className="attempt">
                            {r.testTimestamp
                                ? r.testTimestamp.seconds
                                    ? new Date(
                                        r.testTimestamp.seconds * 1000
                                    ).toLocaleString()
                                    : new Date(r.testTimestamp).toLocaleString()
                                : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="activity-center">
                        <div>Corr: {r.correlation}</div>
                        <div>Verif: {r.verification}</div>
                      </div>

                      <div className="activity-right">
                  <span className={`status-badge ${r.status?.toLowerCase()}`}>
                    {r.status}
                  </span>
                      </div>
                    </div>
                ))
            )}
          </div>
        </div>
      </>
  );
}

function StatsCard({ title, date, stats, isYesterday }) {
  return (
      <div className={`stats-card ${isYesterday ? "yesterday" : ""}`}>
        <div className="stats-header">
          <div className="stats-title">{title}</div>
          <div className="stats-date">{date}</div>
        </div>

        <div className="progress-circles">
          <CircularProgress percentage={stats.passRate} label="Total Pass" color="#4caf50" />
          <CircularProgress percentage={stats.firstAttemptPass} label="First Attempt" sublabel="Pass" color="#4caf50" />
        </div>

        <div className="small-circles">
          <SmallCircle value={stats.totalTests} label="Total Tests" color="#fdd835" />
          <SmallCircle value={stats.productTested} label="Product Tested" color="#ff9800" />
          <SmallCircle value={stats.failedTests} label="Failed Tests" color="#f44336" />
        </div>
      </div>
  );
}

function CircularProgress({ percentage, label, sublabel, color }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
      <div className="circular-progress">
        <svg width="120" height="120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e8e8e8" strokeWidth="12" />
          <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "60px 60px" }}
          />
          <text x="60" y="63" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold">
            {percentage}%
          </text>
        </svg>
        <div className="progress-label">
          <div>{label}</div>
          {sublabel && <div>{sublabel}</div>}
        </div>
      </div>
  );
}

function SmallCircle({ value, label, color }) {
  return (
      <div className="small-circle">
        <div className="circle-outer" style={{ borderColor: color }}>
          <span style={{ color }}>{value}</span>
        </div>
        <div className="circle-label">{label}</div>
      </div>
  );
}

export default DashboardPage;