// src/components/ProductPage.js
import React, { useEffect, useState } from "react";
import {
    collection, getDocs, addDoc, doc, getDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";

function ProductPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState(null);
    const [userIp, setUserIp] = useState("");

    // Get logged-in user's IP from Firestore
    useEffect(() => {
        const fetchUserIp = async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "testers", currentUser.uid));
                    if (userDoc.exists()) {
                        setUserIp(userDoc.data().ip || "");
                    }
                } catch (err) {
                    console.error("Error fetching user IP:", err);
                }
            }
        };
        fetchUserIp();
    }, []);

    const fetchResults = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, "testResults"));
            const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setProducts(data);
            setError(null);
        } catch (err) {
            setError("Cannot connect to database");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchResults();
    }, []);

    // Upload a single .txt file
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadMessage(null);

        try {
            const text = await file.text();
            const lines = text.split("\n");

            // ✅ FIX 1: Always use logged-in user's IP — ignore Device IP in file
            let correlation = "";
            let verification = "";
            let testTimestamp = new Date().toISOString(); // default to now

            for (const line of lines) {
                const lower = line.toLowerCase();

                // ✅ Parse Test Time from file if available
                if (lower.includes("test time")) {
                    const raw = line.split(":").slice(1).join(":").trim();
                    if (raw) {
                        const parsed = new Date(raw);
                        if (!isNaN(parsed)) {
                            testTimestamp = parsed.toISOString();
                        }
                    }
                }

                if (lower.includes("gu correlation")) {
                    correlation = lower.includes("failed") ? "FAILED" :
                        lower.includes("passed") ? "PASSED" : "";
                }

                if (lower.includes("gu verification")) {
                    verification = lower.includes("failed") ? "FAILED" :
                        lower.includes("passed") ? "PASSED" : "";
                }
            }

            const status = (correlation === "PASSED" && verification === "PASSED") ? "PASS" : "FAIL";

            await addDoc(collection(db, "testResults"), {
                ip: userIp,           // ✅ Always logged-in user's IP
                productCode: "ACPP-AP1-RF1",
                correlation,
                verification,
                status,
                testTimestamp,        // ✅ From file's Test Time line, or now
                uploadedBy: auth.currentUser?.email || "unknown",
                fileName: file.name
            });

            setUploadMessage("File uploaded and parsed successfully");
            fetchResults();
        } catch (err) {
            setUploadMessage("Upload failed: " + err.message);
        }

        setUploading(false);
        e.target.value = "";
    };

    // Upload CSV — format: productCode, correlation, verification, testTimestamp
    const handleCsvUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadMessage(null);

        try {
            const text = await file.text();
            const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
            lines.shift(); // skip header
            let count = 0;
            let skipped = 0;

            for (const line of lines) {
                const cols = line.split(",").map(c => c.trim().replace(/\r/g, ""));
                if (cols.length >= 4 && cols[0]) {
                    const productCode = cols[0];
                    const correlation = cols[1].toUpperCase() || "";
                    const verification = cols[2].toUpperCase() || "";
                    const rawTime = cols[3];

                    // ✅ Read timestamp from file (same as TXT) — skip row if invalid
                    const parsed = new Date(rawTime);
                    if (isNaN(parsed)) {
                        console.warn("Skipping row with invalid timestamp:", rawTime);
                        skipped++;
                        continue;
                    }

                    const testTimestamp = parsed.toISOString();
                    const status = (correlation === "PASSED" && verification === "PASSED") ? "PASS" : "FAIL";

                    await addDoc(collection(db, "testResults"), {
                        ip: userIp,
                        productCode,
                        correlation,
                        verification,
                        status,
                        testTimestamp,    // ✅ From file, same as TXT
                        uploadedBy: auth.currentUser?.email || "unknown"
                    });
                    count++;
                } else {
                    skipped++;
                }
            }

            setUploadMessage(`${count} devices imported${skipped > 0 ? `, ${skipped} skipped` : ""}`);
            fetchResults();
        } catch (err) {
            setUploadMessage("CSV upload failed: " + err.message);
        }

        setUploading(false);
        e.target.value = "";
    };

    // Format timestamp for display
    const formatTime = (ts) => {
        if (!ts) return "—";
        const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
        return date.toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    return (
        <div className="page-content">
            <h2 className="page-title">Products & Test History</h2>

            {/* Upload Section */}
            <div className="card" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <label style={{ cursor: "pointer", background: "#5c6bc0", color: "white", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "bold" }}>
                    📂 Upload Single .txt
                    <input type="file" accept=".txt" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
                </label>
                <label style={{ cursor: "pointer", background: "#43a047", color: "white", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "bold" }}>
                    📊 Upload CSV (Bulk)
                    <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={uploading} style={{ display: "none" }} />
                </label>
                {userIp && <span style={{ color: "#888", fontSize: "0.85rem" }}>Uploading as IP: {userIp}</span>}
                {uploading && <span style={{ color: "#888" }}>Uploading...</span>}
                {uploadMessage && <span style={{ color: "#4CAF50", fontWeight: "bold" }}>{uploadMessage}</span>}
            </div>

            {/* Results Table */}
            <div className="card">
                {loading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p style={{ color: "red" }}>Error: {error}</p>
                ) : products.length === 0 ? (
                    <p style={{ color: "#888" }}>No test results yet.</p>
                ) : (
                    <table>
                        <thead>
                        <tr>
                            <th>Product ID (IP)</th>
                            <th>Testing Time</th>
                            <th>Product Code</th>
                            <th>Test History</th>
                            <th>Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {products.map((p) => (
                            <tr key={p.id}>
                                <td>{p.ip}</td>
                                <td>{formatTime(p.testTimestamp)}</td>
                                <td>{p.productCode || "—"}</td>
                                <td>
                                    <div className="test-history">
                                            <span className={`test-result ${p.correlation?.toLowerCase()}`}>
                                                Corr: {p.correlation || "—"}
                                            </span>
                                        <span className={`test-result ${p.verification?.toLowerCase()}`}>
                                                Verif: {p.verification || "—"}
                                            </span>
                                    </div>
                                </td>
                                <td>
                                        <span className={`status-badge ${p.status?.toLowerCase()}`}>
                                            {p.status}
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

export default ProductPage;