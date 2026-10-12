import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, PlusCircle, Brain, BarChart3, Activity,
  Settings, Search, Bell, Menu, X, ArrowUpRight, Clock3, CheckCircle2,
  AlertTriangle, MapPin, Send, Sparkles, ChevronRight, Filter,
  RefreshCw, Download, RotateCcw, LogOut,
} from "lucide-react";

const API = "http://127.0.0.1:5000/api";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Complaints", icon: FileText },
  { name: "Submit Complaint", icon: PlusCircle },
  { name: "AI Insights", icon: Brain },
  { name: "Analytics", icon: BarChart3 },
  { name: "Resolution Tracker", icon: Activity },
  { name: "Settings", icon: Settings },
];

function App() {
  const [page, setPage] = useState("Dashboard");
  const [stats, setStats] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("smartresolveUser")) || null;
    } catch {
      return null;
    }
  });

  const [authPage, setAuthPage] = useState(() => {
    try {
      return localStorage.getItem("smartresolveUser") ? "app" : "register";
    } catch {
      return "register";
    }
  });

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [authError, setAuthError] = useState("");

  const [form, setForm] = useState({
    title: "",
    location: "",
    description: "",
    affected: "",
  });

  function showNotice(message) {
    setNotice(message);
    window.clearTimeout(window.noticeTimer);
    window.noticeTimer = window.setTimeout(() => setNotice(""), 3500);
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await fetch(`${API}/dashboard`);
      if (!response.ok) throw new Error("Dashboard loading failed");

      const data = await response.json();
      setStats(data.stats || {});
      setComplaints(data.complaints || []);
    } catch {
      showNotice("Backend connection failed. Check whether Flask is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authPage === "app" && currentUser) loadDashboard();
  }, [authPage, currentUser]);

  function handleRegister(event) {
    event.preventDefault();
    setAuthError("");

    const name = authForm.name.trim();
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;

    if (!name || !email || !password) {
      setAuthError("Please fill all required fields.");
      return;
    }

    let registeredUsers = [];
    try {
      registeredUsers = JSON.parse(
        localStorage.getItem("smartresolveRegisteredUsers") || "[]"
      );
    } catch {
      registeredUsers = [];
    }

    if (registeredUsers.some((user) => user.email === email)) {
      setAuthError("This email is already registered. Please login.");
      return;
    }

    registeredUsers.push({ name, email, password });
    localStorage.setItem(
      "smartresolveRegisteredUsers",
      JSON.stringify(registeredUsers)
    );

    setAuthForm({ name: "", email, password: "" });
    setAuthPage("login");
    setAuthError("");
    showNotice("Registration successful. Please login.");
  }

  function handleLogin(event) {
    event.preventDefault();
    setAuthError("");

    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password;

    let registeredUsers = [];
    try {
      registeredUsers = JSON.parse(
        localStorage.getItem("smartresolveRegisteredUsers") || "[]"
      );
    } catch {
      registeredUsers = [];
    }

    const registeredUser = registeredUsers.find(
      (user) => user.email === email && user.password === password
    );

    if (!registeredUser) {
      setAuthError("Invalid email or password. Please register or try again.");
      return;
    }

    const user = {
      name: registeredUser.name,
      email: registeredUser.email,
    };

    localStorage.setItem("smartresolveUser", JSON.stringify(user));
    setCurrentUser(user);
    setPage("Dashboard");
    setAuthPage("app");
    setAuthError("");
  }

  function handleLogout() {
    localStorage.removeItem("smartresolveUser");
    setCurrentUser(null);
    setAuthForm({ name: "", email: "", password: "" });
    setAuthError("");
    setPage("Dashboard");
    setAuthPage("login");
    setNotificationOpen(false);
    setSelectedComplaint(null);
    showNotice("You have been logged out.");
  }

  async function submitComplaint(event) {
    event.preventDefault();

    try {
      const response = await fetch(`${API}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      // Duplicate complaint handling
      if (response.status === 409) {
        showNotice(data.message || "This same complaint already exists.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Submission failed");
      }

      setForm({
        title: "",
        location: "",
        description: "",
        affected: "",
      });

      showNotice("Complaint submitted and analyzed successfully.");
      setPage("Complaints");
      await loadDashboard();
    } catch (error) {
      showNotice(error.message || "Could not submit complaint.");
    }
  }

  async function updateStatus(id, status) {
    try {
      const response = await fetch(`${API}/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Status update failed");
      }

      showNotice("Complaint status updated successfully.");
      setSelectedComplaint((current) =>
        current && String(current.id) === String(id)
          ? { ...current, status }
          : current
      );
      await loadDashboard();
    } catch (error) {
      showNotice(error.message || "Could not update status.");
    }
  }

  const filtered = complaints.filter((item) => {
    const matchesSearch = `${item.title || ""} ${item.location || ""} ${
      item.category || ""
    } ${item.status || ""} ${item.priority || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const urgentCount =
    stats.urgent ?? complaints.filter((c) => c.priority === "Urgent").length;

  const pendingCount =
    stats.pending ?? complaints.filter((c) => c.status === "Pending").length;

  const resolvedCount =
    stats.resolved ?? complaints.filter((c) => c.status === "Resolved").length;

  const inProgressCount = complaints.filter(
    (c) => c.status === "In Progress"
  ).length;

  function changePage(name) {
    setPage(name);
    setMobileOpen(false);
    setNotificationOpen(false);
    setSelectedComplaint(null);
  }

  function exportComplaints() {
    if (complaints.length === 0) {
      showNotice("No complaints available to export.");
      return;
    }

    const headers = [
      "ID", "Title", "Category", "Location", "Priority",
      "Status", "Description", "People Affected",
    ];

    const rows = complaints.map((c) => [
      c.id, c.title, c.category, c.location, c.priority,
      c.status, c.description, c.affected,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "smartresolve-complaints.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice("Complaint report downloaded.");
  }

  function AuthScreen() {
    const isRegister = authPage === "register";

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background:
            "radial-gradient(circle at top left, rgba(99,102,241,.18), transparent 35%), #080d1b",
        }}
      >
        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          className="complaint-form"
          style={{
            width: "100%",
            maxWidth: "440px",
            padding: "34px",
            borderRadius: "18px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div
              className="brand-mark"
              style={{
                width: "54px",
                height: "54px",
                margin: "0 auto 16px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Brain size={26} />
            </div>
            <h1 style={{ marginBottom: "8px" }}>SmartResolve AI</h1>
            <p>
              {isRegister
                ? "Create your account to get started"
                : "Welcome back. Login to continue"}
            </p>
          </div>

          {isRegister && (
            <label>
              Full name <b>*</b>
              <input
                required
                autoComplete="name"
                placeholder="Enter your name"
                value={authForm.name}
                onChange={(event) =>
                  setAuthForm({ ...authForm, name: event.target.value })
                }
              />
            </label>
          )}

          <label>
            Email address <b>*</b>
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm({ ...authForm, email: event.target.value })
              }
            />
          </label>

          <label>
            Password <b>*</b>
            <input
              required
              type="password"
              minLength="6"
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="Enter your password"
              value={authForm.password}
              onChange={(event) =>
                setAuthForm({ ...authForm, password: event.target.value })
              }
            />
          </label>

          {authError && (
            <p
              style={{
                color: "#fb7185",
                margin: "12px 0",
                fontSize: "14px",
              }}
            >
              {authError}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            style={{
              width: "100%",
              justifyContent: "center",
              marginTop: "12px",
            }}
          >
            {isRegister ? "Create Account" : "Login to Dashboard"}
            <ArrowUpRight size={16} />
          </button>

          <p style={{ textAlign: "center", marginTop: "22px" }}>
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthError("");
                setAuthPage(isRegister ? "login" : "register");
              }}
            >
              {isRegister ? "Login" : "Register"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  function Sidebar() {
    return (
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Brain size={23} />
          </div>
          <div>
            <strong>SmartResolve</strong>
            <span>AI COMPLAINT INTELLIGENCE</span>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => changePage(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {page === name && <ChevronRight size={16} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-card">
            <span className="online-dot" />
            <div>
              <strong>AI Engine Active</strong>
              <small>System operational</small>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">VD</div>
            <div>
              <strong>{currentUser?.name || "Administrator"}</strong>
              <small>{currentUser?.email || "System Manager"}</small>
            </div>
            <button
              className="icon-button"
              title="Logout"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  function Header() {
    return (
      <header className="topbar">
        <button
          className="mobile-menu"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu />
        </button>

        <div className="breadcrumb">
          Workspace <span>/</span> <strong>{page}</strong>
        </div>

        <div className="top-actions">
          <div className="system-status">
            <span className="online-dot" />
            All systems operational
          </div>

          <button
            className="icon-button"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => setNotificationOpen(!notificationOpen)}
          >
            <Bell size={18} />
          </button>

          <button
            className="top-avatar"
            title="Logout"
            onClick={handleLogout}
            style={{ cursor: "pointer", border: "none" }}
          >
            VD
          </button>
        </div>

        {notificationOpen && (
          <div
            className="panel"
            style={{
              position: "absolute",
              right: "35px",
              top: "62px",
              zIndex: 30,
              width: "280px",
              padding: "16px",
              boxShadow: "0 12px 35px rgba(0,0,0,0.35)",
            }}
          >
            <div className="panel-heading">
              <div>
                <h2>Notifications</h2>
                <p>Complaint activity summary</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setNotificationOpen(false)}
                aria-label="Close notifications"
              >
                <X size={15} />
              </button>
            </div>

            <div className="insight-item">
              <AlertTriangle size={18} />
              <div>
                <strong>{urgentCount} urgent complaints</strong>
                <p>Cases requiring attention</p>
              </div>
            </div>

            <div className="insight-item">
              <Clock3 size={18} />
              <div>
                <strong>{pendingCount} pending complaints</strong>
                <p>Waiting for action</p>
              </div>
            </div>

            <div className="insight-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>{resolvedCount} resolved complaints</strong>
                <p>Completed cases</p>
              </div>
            </div>

            <button
              className="outline-button"
              style={{ width: "100%", marginTop: "12px" }}
              onClick={() => changePage("Complaints")}
            >
              View complaints <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </header>
    );
  }

  function StatCard({ title, value, note, icon: Icon, color }) {
    return (
      <div className="stat-card">
        <div className={`stat-icon ${color}`}>
          <Icon size={20} />
        </div>
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value ?? 0}</div>
        <div className="stat-note">{note}</div>
        <ArrowUpRight className="stat-arrow" size={17} />
      </div>
    );
  }

  function ComplaintTable({ items }) {
    return (
      <div className="table-wrap">
        <table>
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
            {items.map((item) => {
              const priority = item.priority || "Normal";

              return (
                <tr
                  key={item.id}
                  onClick={() => setSelectedComplaint(item)}
                  style={{ cursor: "pointer" }}
                  title="Click to view complaint details"
                >
                  <td>
                    <strong>{item.title}</strong>
                    <small className="sub-cell">
                      SR-{String(item.id).padStart(4, "0")}
                    </small>
                  </td>

                  <td>{item.category || "General"}</td>

                  <td>
                    <span className="location-cell">
                      <MapPin size={13} />
                      {item.location}
                    </span>
                  </td>

                  <td>
                    <span className={`priority ${String(priority).toLowerCase()}`}>
                      {priority}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status ${String(item.status || "Pending")
                        .toLowerCase()
                        .replace(" ", "-")}`}
                    >
                      {item.status || "Pending"}
                    </span>
                  </td>

                  <td>
                    <select
                      value={item.status || "Pending"}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        event.stopPropagation();
                        updateStatus(item.id, event.target.value);
                      }}
                      aria-label={`Update status for complaint ${item.id}`}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Resolved</option>
                    </select>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan="6" className="empty">
                  No complaints found. Submit your first complaint to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function ComplaintDetailsModal() {
    if (!selectedComplaint) return null;

    const item = selectedComplaint;

    return (
      <div
        onClick={() => setSelectedComplaint(null)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.72)",
          display: "grid",
          placeItems: "center",
          padding: "20px",
        }}
      >
        <div
          className="panel"
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: "600px",
            padding: "24px",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          <div className="panel-heading">
            <div>
              <h2>Complaint Details</h2>
              <p>SR-{String(item.id).padStart(4, "0")}</p>
            </div>
            <button
              className="icon-button"
              onClick={() => setSelectedComplaint(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: "grid", gap: "16px", marginTop: "20px" }}>
            <div>
              <small>COMPLAINT TITLE</small>
              <h3>{item.title || "Not available"}</h3>
            </div>
            <div>
              <small>CATEGORY</small>
              <p>{item.category || "General"}</p>
            </div>
            <div>
              <small>LOCATION</small>
              <p>{item.location || "Not available"}</p>
            </div>
            <div>
              <small>DESCRIPTION</small>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {item.description || "No description available"}
              </p>
            </div>
            <div>
              <small>PEOPLE AFFECTED</small>
              <p>{item.affected || "Not specified"}</p>
            </div>
            <div>
              <small>AI PRIORITY</small>
              <p>{item.priority || "Normal"}</p>
            </div>
            <div>
              <small>CURRENT STATUS</small>
              <p>{item.status || "Pending"}</p>
            </div>

            <label>
              Update status
              <select
                value={item.status || "Pending"}
                onChange={(event) => updateStatus(item.id, event.target.value)}
              >
                <option>Pending</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    );
  }

  function Dashboard() {
    return (
      <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              INTELLIGENT COMPLAINT MANAGEMENT
            </div>
            <h1>Welcome back, {currentUser?.name || "User"}</h1>
            <p>Your complaint intelligence overview is ready.</p>
          </div>
          <button
            className="primary-button"
            onClick={() => changePage("Submit Complaint")}
          >
            <PlusCircle size={17} />
            New Complaint
          </button>
        </section>

        <section className="stats-grid">
          <StatCard title="Total Complaints" value={stats.total ?? complaints.length} note="All submitted reports" icon={FileText} color="blue" />
          <StatCard title="Urgent Priority" value={urgentCount} note="Requires attention" icon={AlertTriangle} color="red" />
          <StatCard title="Pending Resolution" value={pendingCount} note="Awaiting action" icon={Clock3} color="orange" />
          <StatCard title="Successfully Resolved" value={resolvedCount} note="Completed cases" icon={CheckCircle2} color="green" />
        </section>

        <section className="content-grid">
          <div className="panel complaints-panel">
            <div className="panel-heading">
              <div>
                <h2>Priority Complaint Queue</h2>
                <p>Live overview of reported issues</p>
              </div>
              <button className="text-button" onClick={() => changePage("Complaints")}>
                View all <ArrowUpRight size={15} />
              </button>
            </div>
            <ComplaintTable items={[...complaints].slice(0, 5)} />
          </div>

          <div className="panel insight-panel">
            <div className="panel-heading">
              <div>
                <h2><Sparkles size={17} /> AI Intelligence</h2>
                <p>Automated system insights</p>
              </div>
              <span className="live-tag">LIVE</span>
            </div>

            <div className="ai-highlight">
              <div className="ai-orb"><Brain size={22} /></div>
              <div>
                <strong>AI analysis is active</strong>
                <p>New complaints are automatically categorized and prioritized.</p>
              </div>
            </div>

            <div className="insight-item">
              <span className="insight-icon purple"><Activity size={16} /></span>
              <div>
                <strong>{urgentCount} urgent cases</strong>
                <p>Review high-priority complaints first.</p>
              </div>
            </div>

            <div className="insight-item">
              <span className="insight-icon green"><CheckCircle2 size={16} /></span>
              <div>
                <strong>{resolvedCount} cases resolved</strong>
                <p>Resolution progress is tracked automatically.</p>
              </div>
            </div>

            <button className="outline-button" onClick={() => changePage("AI Insights")}>
              Explore AI insights <ArrowUpRight size={15} />
            </button>
          </div>
        </section>

        <div className="bottom-banner">
          <div className="banner-icon"><Brain size={21} /></div>
          <div>
            <strong>Smarter decisions. Faster resolutions.</strong>
            <p>AI-powered complaint intelligence helps teams focus on what matters.</p>
          </div>
          <button onClick={() => changePage("Submit Complaint")}>
            Create a report <ChevronRight size={16} />
          </button>
        </div>
      </>
    );
  }

  function SubmitPage() {
    return (
      <section className="form-layout">
        <div className="form-intro">
          <div className="eyebrow"><span className="eyebrow-line" /> NEW CASE</div>
          <h1>Submit a complaint</h1>
          <p>Describe the issue. SmartResolve AI will analyze it and suggest the next action.</p>

          <div className="form-feature">
            <Brain size={21} />
            <div>
              <strong>Intelligent case analysis</strong>
              <p>Your complaint is automatically classified and prioritized using text analysis.</p>
            </div>
          </div>

          <div className="form-feature">
            <Activity size={21} />
            <div>
              <strong>Track every resolution</strong>
              <p>Follow the status of your complaint from submission to completion.</p>
            </div>
          </div>
        </div>

        <form className="complaint-form" onSubmit={submitComplaint}>
          <div className="form-heading">
            <span>COMPLAINT DETAILS</span>
            <span className="required-note">* Required fields</span>
          </div>

          <label>
            Complaint title <b>*</b>
            <input required maxLength="100" placeholder="Briefly describe the issue" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>

          <label>
            Location <b>*</b>
            <input required placeholder="Area, street or department" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          </label>

          <label>
            Description <b>*</b>
            <textarea required rows="5" placeholder="Explain what happened, when it happened, and who is affected..." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <label>
            People affected <span className="optional">(optional)</span>
            <input placeholder="Example: 20 residents" value={form.affected} onChange={(event) => setForm({ ...form, affected: event.target.value })} />
          </label>

          <div className="form-footer">
            <span><span className="secure-dot" /> Information is stored securely in this demo system</span>
            <button className="primary-button" type="submit"><Send size={16} /> Analyze & Submit</button>
          </div>
        </form>
      </section>
    );
  }

  function InsightsPage() {
    const categories = {};
    complaints.forEach((complaint) => {
      const key = complaint.category || "General";
      categories[key] = (categories[key] || 0) + 1;
    });

    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];

    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><h2><Brain size={19} /> AI Complaint Insights</h2><p>Patterns derived from submitted complaints</p></div>
          <button className="outline-button" onClick={loadDashboard}><RefreshCw size={15} /> Refresh</button>
        </div>

        <div className="insight-summary">
          <div className="summary-block"><span>Total analyzed</span><strong>{complaints.length}</strong></div>
          <div className="summary-block"><span>Urgent cases</span><strong>{urgentCount}</strong></div>
          <div className="summary-block"><span>Categories detected</span><strong>{Object.keys(categories).length}</strong></div>
        </div>

        <h3 className="section-subtitle">Complaint categories</h3>
        {Object.entries(categories).map(([name, count]) => (
          <div className="category-row" key={name}>
            <span>{name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${complaints.length ? (count / complaints.length) * 100 : 0}%` }} /></div>
            <strong>{count}</strong>
          </div>
        ))}

        {topCategory && (
          <div className="ai-highlight" style={{ marginTop: "22px" }}>
            <div className="ai-orb"><Sparkles size={20} /></div>
            <div>
              <strong>Most reported category: {topCategory[0]}</strong>
              <p>{topCategory[1]} complaint(s) are currently recorded in this category.</p>
            </div>
          </div>
        )}
        {complaints.length === 0 && <p className="empty">Submit complaints to see AI insights here.</p>}
      </section>
    );
  }

  function AnalyticsPage() {
    const total = complaints.length;
    const statusCounts = {
      Pending: complaints.filter((c) => c.status === "Pending").length,
      "In Progress": inProgressCount,
      Resolved: resolvedCount,
    };
    const categoryCounts = {};

    complaints.forEach((c) => {
      const category = c.category || "General";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><h2><BarChart3 size={19} /> Complaint Analytics</h2><p>Live analysis based on submitted complaints</p></div>
          <button className="outline-button" onClick={loadDashboard}><RefreshCw size={15} /> Refresh</button>
        </div>

        <div className="insight-summary">
          <div className="summary-block"><span>Total complaints</span><strong>{total}</strong></div>
          <div className="summary-block"><span>Urgent complaints</span><strong>{urgentCount}</strong></div>
          <div className="summary-block"><span>Resolution rate</span><strong>{total ? Math.round((resolvedCount / total) * 100) : 0}%</strong></div>
        </div>

        <h3 className="section-subtitle">Status distribution</h3>
        {Object.entries(statusCounts).map(([name, count]) => (
          <div className="category-row" key={name}>
            <span>{name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
            <strong>{count}</strong>
          </div>
        ))}

        <h3 className="section-subtitle" style={{ marginTop: 28 }}>Category distribution</h3>
        {Object.entries(categoryCounts).map(([name, count]) => (
          <div className="category-row" key={name}>
            <span>{name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
            <strong>{count}</strong>
          </div>
        ))}
        {total === 0 && <p className="empty">Submit complaints to generate analytics.</p>}
      </section>
    );
  }

  function ResolutionTracker() {
    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><h2><Activity size={19} /> Resolution Tracker</h2><p>Track every complaint from submission to resolution</p></div>
          <button className="outline-button" onClick={loadDashboard}><RefreshCw size={15} /> Refresh</button>
        </div>

        <div className="insight-summary">
          <div className="summary-block"><span>Pending</span><strong>{pendingCount}</strong></div>
          <div className="summary-block"><span>In Progress</span><strong>{inProgressCount}</strong></div>
          <div className="summary-block"><span>Resolved</span><strong>{resolvedCount}</strong></div>
        </div>
        <ComplaintTable items={complaints} />
      </section>
    );
  }

  function SettingsPage() {
    return (
      <section className="panel page-panel">
        <div className="panel-heading">
          <div><h2><Settings size={19} /> Settings</h2><p>Manage your SmartResolve workspace</p></div>
        </div>

        <div className="insight-item">
          <div><strong>System status</strong><p>Backend API: {API}</p></div>
          <span className="live-tag">ACTIVE</span>
        </div>

        <div className="insight-item">
          <div><strong>Complaint data</strong><p>{complaints.length} complaint records are available.</p></div>
          <button className="outline-button" onClick={loadDashboard}><RefreshCw size={14} /> Refresh data</button>
        </div>

        <div className="insight-item">
          <div><strong>Clear complaint search</strong><p>Reset the search field in the Complaints page.</p></div>
          <button className="outline-button" onClick={() => { setSearch(""); setStatusFilter("All"); showNotice("Complaint search and filter cleared."); }}><RotateCcw size={14} /> Clear search</button>
        </div>

        <div className="insight-item">
          <div><strong>Export complaint report</strong><p>Download current complaint records as a CSV file.</p></div>
          <button className="outline-button" onClick={exportComplaints}><Download size={14} /> Export CSV</button>
        </div>

        <div className="insight-item">
          <div><strong>Signed in as</strong><p>{currentUser?.name} — {currentUser?.email}</p></div>
          <button className="outline-button" onClick={handleLogout}><LogOut size={14} /> Logout</button>
        </div>

        <div className="insight-item">
          <div><strong>Administrator session</strong><p>Current workspace is running in local demo mode.</p></div>
          <span className="status in-progress">Demo</span>
        </div>
      </section>
    );
  }

  if (authPage !== "app" || !currentUser) return <AuthScreen />;

  return (
    <div className="app-shell">
      <ComplaintDetailsModal />
      <Sidebar />

      {mobileOpen && (
        <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      )}

      <main className="main-area">
        <Header />

        <div className="page-content">
          {notice && (
            <div className="notice">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button>
            </div>
          )}

          {loading ? (
            <div className="loading"><RefreshCw className="spin" /> Loading dashboard...</div>
          ) : page === "Dashboard" ? (
            <Dashboard />
          ) : page === "Submit Complaint" ? (
            <SubmitPage />
          ) : page === "AI Insights" ? (
            <InsightsPage />
          ) : page === "Analytics" ? (
            <AnalyticsPage />
          ) : page === "Resolution Tracker" ? (
            <ResolutionTracker />
          ) : page === "Settings" ? (
            <SettingsPage />
          ) : page === "Complaints" ? (
            <section className="panel page-panel">
              <div className="panel-heading">
                <div><h2>All complaints</h2><p>Search, review and update submitted cases</p></div>
                <button className="outline-button" onClick={loadDashboard}><RefreshCw size={15} /> Refresh</button>
              </div>

              <div className="table-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search complaints..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter complaints by status"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>

                <span><Filter size={15} /> {filtered.length} records</span>
              </div>

              <ComplaintTable items={filtered} />
            </section>
          ) : (
            <Dashboard />
          )}

          <footer className="footer">
            © 2026 SmartResolve AI <span>•</span> Intelligent Complaint Management System
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;