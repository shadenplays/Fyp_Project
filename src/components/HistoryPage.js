// src/components/HistoryPage.js
import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function HistoryPage() {
  const [allLogs, setAllLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // ✅ Convert timestamp safely
  const getDateObj = (ts) => {
    if (!ts) return null;

    if (ts.seconds) {
      return new Date(ts.seconds * 1000); // Firestore timestamp
    }

    return new Date(ts); // ISO string
  };

  // ✅ Format display (same as ProductPage)
  const formatDisplay = (ts) => {
    const date = getDateObj(ts);
    if (!date) return "—";

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ Extract YYYY-MM-DD for filtering
  const getDateOnly = (ts) => {
    const date = getDateObj(ts);
    if (!date) return null;

    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const snapshot = await getDocs(collection(db, "testResults"));
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // ✅ Sort by latest timestamp
        data.sort((a, b) => {
          const timeA = getDateObj(a.testTimestamp)?.getTime() || 0;
          const timeB = getDateObj(b.testTimestamp)?.getTime() || 0;
          return timeB - timeA;
        });

        setAllLogs(data);
        setFilteredLogs(data);
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchLogs();
  }, []);

  // ✅ Apply filters
  const handleApply = () => {
    let filtered = [...allLogs];

    if (startDate) {
      filtered = filtered.filter(
        (l) => getDateOnly(l.testTimestamp) >= startDate
      );
    }

    if (endDate) {
      filtered = filtered.filter(
        (l) => getDateOnly(l.testTimestamp) <= endDate
      );
    }

    if (statusFilter !== "All") {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    setFilteredLogs(filtered);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("All");
    setFilteredLogs(allLogs);
  };

  return (
    <div className="page-content">
      <h2 className="page-title">Test History Logs</h2>

      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>PASS</option>
              <option>FAIL</option>
            </select>
          </div>
        </div>

        <div className="filter-btns">
          <button className="filter-btn apply-btn" onClick={handleApply}>
            Apply Filters
          </button>
          <button className="filter-btn reset-btn" onClick={handleReset}>
            Reset Filters
          </button>
        </div>
      </div>

      <div className="card">
        {filteredLogs.length === 0 ? (
          <p style={{ color: "#888", padding: "1rem" }}>
            No test history found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Testing Time</th>
                <th>Device IP</th>
                <th>Correlation</th>
                <th>Verification</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDisplay(log.testTimestamp)}</td>
                  <td>{log.ip}</td>
                  <td>{log.correlation}</td>
                  <td>{log.verification}</td>
                  <td>
                    <span
                      className={`status-badge ${log.status?.toLowerCase()}`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;