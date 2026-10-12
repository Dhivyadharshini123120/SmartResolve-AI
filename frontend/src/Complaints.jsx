```jsx
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:5000/api";

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  async function fetchComplaints() {
    try {
      setError("");

      const response = await fetch(`${API}/complaints`);

      if (!response.ok) {
        throw new Error("Could not fetch complaints");
      }

      const data = await response.json();

      const records = Array.isArray(data)
        ? data
        : data.complaints || data.data || [];

      setComplaints(records);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Unable to load complaints. Check the backend server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchComplaints();
  }, []);

  const items = complaints.filter((complaint) => {
    const searchText = [
      complaint.id,
      complaint.title,
      complaint.location,
      complaint.category,
      complaint.description,
      complaint.priority,
      complaint.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchText.includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All Status" ||
      (complaint.status || "Pending") === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="complaints-page">
      <style>{`
        .complaints-page {
          padding: 24px;
          color: #e5e7eb;
          min-height: 100%;
        }

        .complaints-page * {
          box-sizing: border-box;
        }

        .complaints-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .complaints-header h1 {
          margin: 0 0 8px;
          font-size: 28px;
        }

        .complaints-header p {
          margin: 0;
          color: #94a3b8;
        }

        .complaints-page button {
          padding: 10px 16px;
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
        }

        .complaints-filters {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .complaints-filters input {
          flex: 1;
          min-width: 200px;
        }

        .complaints-filters input,
        .complaints-filters select,
        .complaints-table select {
          padding: 11px 12px;
          border: 1px solid #374151;
          border-radius: 8px;
          background: #111827;
          color: #e5e7eb;
        }

        .complaints-count {
          margin-bottom: 14px;
          color: #94a3b8;
          font-size: 14px;
        }

        .complaints-table-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #293548;
          border-radius: 12px;
          background: #111827;
        }

        .complaints-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        .complaints-table th,
        .complaints-table td {
          padding: 15px 13px;
          border-bottom: 1px solid #293548;
          text-align: left;
          vertical-align: top;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .complaints-table th {
          background: #172033;
          color: #94a3b8;
          white-space: nowrap;
        }

        .complaint-title {
          font-weight: 600;
          color: #f8fafc;
        }

        .complaint-description {
          margin-top: 6px;
          color: #94a3b8;
          max-width: 260px;
          line-height: 1.5;
        }

        .priority-badge {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          background: #334155;
          white-space: nowrap;
        }

        .priority-badge.urgent,
        .priority-badge.high {
          background: #451a1a;
          color: #fca5a5;
        }

        .priority-badge.medium {
          background: #422006;
          color: #fcd34d;
        }

        .priority-badge.low {
          background: #14532d;
          color: #86efac;
        }

        .complaints-message {
          padding: 22px;
          margin: 14px 0;
          border-radius: 10px;
          background: #172033;
          color: #cbd5e1;
        }

        .complaints-footer {
          margin-top: 28px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
      `}</style>

      <div className="complaints-header">
        <div>
          <h1>All complaints</h1>
          <p>Search, review and update submitted cases</p>
        </div>

        <button onClick={fetchComplaints}>
          ↻ Refresh
        </button>
      </div>

      <div className="complaints-filters">
        <input
          type="search"
          placeholder="Search complaints or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>Pending</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </div>

      <div className="complaints-count">
        {items.length} records
      </div>

      {loading && (
        <div className="complaints-message">
          Loading complaints...
        </div>
      )}

      {!loading && error && (
        <div className="complaints-message">
          <p>{error}</p>
          <button onClick={fetchComplaints}>Try Again</button>
        </div>
      )}

      {!loading && !error && (
        <div className="complaints-table-wrapper">
          <table className="complaints-table">
            <thead>
              <tr>
                <th>COMPLAINT</th>
                <th>CATEGORY</th>
                <th>LOCATION</th>
                <th>AI PRIORITY</th>
                <th>STATUS</th>
                <th>UPDATE</th>
              </tr>
            </thead>

            <tbody>
              {items.map((complaint) => (
                <tr key={complaint.id}>
                  <td>
                    <div className="complaint-title">
                      {complaint.title || "Untitled complaint"}
                    </div>

                    <div className="complaint-description">
                      {complaint.description || "No description"}
                    </div>

                    <div className="complaint-description">
                      ID: {complaint.id} | Affected:{" "}
                      {complaint.affected ?? 0}
                    </div>
                  </td>

                  <td>{complaint.category || "General"}</td>

                  <td>{complaint.location || "Not specified"}</td>

                  <td>
                    <span
                      className={
                        "priority-badge " +
                        (complaint.priority || "normal").toLowerCase()
                      }
                    >
                      {complaint.priority || "Normal"}
                    </span>
                  </td>

                  <td>{complaint.status || "Pending"}</td>

                  <td>
                    <select
                      value={complaint.status || "Pending"}
                      onChange={async (e) => {
                        const newStatus = e.target.value;

                        try {
                          const response = await fetch(
                            `${API}/complaints/${complaint.id}/status`,
                            {
                              method: "PUT",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                status: newStatus,
                              }),
                            }
                          );

                          if (!response.ok) {
                            throw new Error("Status update failed");
                          }

                          await fetchComplaints();
                        } catch (err) {
                          console.error(err);
                          alert(
                            "Status update failed. Please check the backend."
                          );
                        }
                      }}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan="6" className="complaints-message">
                    {complaints.length === 0
                      ? "No complaints found. Submit your first complaint to get started."
                      : "No complaints match your search or status filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="complaints-footer">
        © 2026 SmartResolve AI • Intelligent Complaint Management System
      </div>
    </div>
  );
}
```