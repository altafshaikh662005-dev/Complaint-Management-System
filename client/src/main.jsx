import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { authApi, complaintApi, userApi } from "./api";

const TOKEN_KEY = "complaint_management_token";

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "—");

const statusClass = (status) => {
  switch (status) {
    case "SUBMITTED":
      return "status submitted";
    case "ASSIGNED":
      return "status assigned";
    case "IN_PROGRESS":
      return "status in-progress";
    case "RESOLVED":
      return "status resolved";
    default:
      return "status default";
  }
};

const priorityClass = (priority) => {
  switch (priority) {
    case "LOW":
      return "priority low";
    case "MEDIUM":
      return "priority medium";
    case "HIGH":
      return "priority high";
    default:
      return "priority default";
  }
};

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const detailsRef = useRef(null);
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [nextStatus, setNextStatus] = useState("SUBMITTED");
  const [resolutionComment, setResolutionComment] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [complaintForm, setComplaintForm] = useState({
    title: "",
    description: "",
    category: "IT",
    priority: "MEDIUM",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadComplaints = async () => {
    if (!token) {
      setComplaints([]);
      return false;
    }

    try {
      const data = await complaintApi.getComplaints(token);
      setComplaints(Array.isArray(data) ? data : []);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      return undefined;
    }

    let isCurrent = true;
    const loadUser = async () => {
      try {
        const data = await authApi.getMe(token);
        if (isCurrent) {
          setUser(data);
        }
      } catch {
        if (isCurrent) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setUser(null);
        }
      }
    };

    loadUser();
    return () => {
      isCurrent = false;
    };
  }, [token]);

  useEffect(() => {
    if (user) {
      loadComplaints();
    }
  }, [user]);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") {
      setUsers([]);
      return undefined;
    }

    let isCurrent = true;
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const data = await userApi.getUsers(token);
        if (isCurrent) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isCurrent) {
          setUsers([]);
          setError(err.message);
        }
      } finally {
        if (isCurrent) {
          setIsLoadingUsers(false);
        }
      }
    };

    loadUsers();
    return () => {
      isCurrent = false;
    };
  }, [token, user?.role]);

  const selectedComplaint =
    complaints.find((item) => item._id === selectedComplaintId) || null;

  const handleViewComplaint = (complaint) => {
    setSelectedComplaintId(complaint._id);
    setAssignmentUserId(complaint.assignedTo?._id || "");
    setNextStatus(complaint.status);
    setResolutionComment("");
    setError("");
    setMessage("");
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleComplaintChange = (event) => {
    const { name, value } = event.target;
    setComplaintForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
            };

      const data =
        authMode === "login"
          ? await authApi.login(payload)
          : await authApi.register(payload);

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setMessage(
        authMode === "login" ? "Login successful." : "Registration successful.",
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleComplaintSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const created = await complaintApi.createComplaint(complaintForm, token);
      setComplaintForm({
        title: "",
        description: "",
        category: "IT",
        priority: "MEDIUM",
      });
      setSelectedComplaintId(created._id);
      await loadComplaints();
      setMessage("Complaint submitted successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignComplaint = async (complaintId, assignedUserId) => {
    if (!users.some((candidate) => candidate._id === assignedUserId)) {
      setError("Select a valid user to assign this complaint.");
      return;
    }

    setError("");
    setMessage("");
    setIsAssigning(true);
    try {
      const updatedComplaint = await complaintApi.assignComplaint(
        complaintId,
        { assignedTo: assignedUserId },
        token,
      );
      const refreshed = await loadComplaints();
      setNextStatus(updatedComplaint.status);
      setMessage("Complaint assigned successfully.");
      if (!refreshed) {
        setMessage(
          "Complaint assigned, but the complaint list could not be refreshed.",
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleStatusUpdate = async (complaintId, nextStatus) => {
    try {
      await complaintApi.updateStatus(
        complaintId,
        { status: nextStatus },
        token,
      );
      await loadComplaints();
      setNextStatus(nextStatus);
      setMessage("Complaint status updated.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResolveComplaint = async (complaintId, resolutionComment) => {
    if (!resolutionComment.trim()) {
      setError("Resolution comment is required.");
      return;
    }

    try {
      await complaintApi.resolveComplaint(
        complaintId,
        { resolutionComment },
        token,
      );
      await loadComplaints();
      setNextStatus("RESOLVED");
      setResolutionComment("");
      setMessage("Complaint resolved successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteComplaint = async (complaintId) => {
    try {
      await complaintApi.deleteComplaint(complaintId, token);
      await loadComplaints();
      setSelectedComplaintId(null);
      setMessage("Complaint deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setComplaints([]);
    setUsers([]);
    setSelectedComplaintId(null);
    setMessage("");
    setError("");
  };

  const stats =
    user?.role === "ADMIN"
      ? {
          total: complaints.length,
          submitted: complaints.filter((item) => item.status === "SUBMITTED")
            .length,
          assigned: complaints.filter((item) => item.status === "ASSIGNED")
            .length,
          inProgress: complaints.filter((item) => item.status === "IN_PROGRESS")
            .length,
          resolved: complaints.filter((item) => item.status === "RESOLVED")
            .length,
        }
      : {
          total: complaints.length,
          submitted: complaints.filter((item) => item.status === "SUBMITTED")
            .length,
          inProgress: complaints.filter((item) => item.status === "IN_PROGRESS")
            .length,
          resolved: complaints.filter((item) => item.status === "RESOLVED")
            .length,
        };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MSc IT DevOps Project</p>
          <h1>Complaint Management System</h1>
        </div>
        {token && user && (
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {!token || !user ? (
        <main className="content auth-layout">
          <section className="card auth-panel">
            <div className="tab-row">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === "register" && (
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthChange}
                    placeholder="Enter your full name"
                    required
                  />
                </label>
              )}

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  placeholder="Enter your email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  placeholder="Enter your password"
                  required
                />
              </label>

              <button type="submit" className="primary-btn">
                {authMode === "login" ? "Login" : "Register"}
              </button>
            </form>

            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </section>
        </main>
      ) : (
        <main className="content dashboard-layout">
          <section className="card profile-card">
            <h2>Profile</h2>
            <p>
              Logged in as <strong>{user.name}</strong>
            </p>
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
          </section>

          {user.role === "USER" ? (
            <>
              <section className="stats-grid">
                <div className="stat-card">
                  <span>Total</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="stat-card">
                  <span>Submitted</span>
                  <strong>{stats.submitted}</strong>
                </div>
                <div className="stat-card">
                  <span>In Progress</span>
                  <strong>{stats.inProgress}</strong>
                </div>
                <div className="stat-card">
                  <span>Resolved</span>
                  <strong>{stats.resolved}</strong>
                </div>
              </section>

              <section className="card">
                <h2>Submit Complaint</h2>
                <form
                  onSubmit={handleComplaintSubmit}
                  className="complaint-form"
                >
                  <label>
                    Title
                    <input
                      type="text"
                      name="title"
                      value={complaintForm.title}
                      onChange={handleComplaintChange}
                      required
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      name="description"
                      value={complaintForm.description}
                      onChange={handleComplaintChange}
                      required
                    />
                  </label>

                  <div className="two-col">
                    <label>
                      Category
                      <select
                        name="category"
                        value={complaintForm.category}
                        onChange={handleComplaintChange}
                      >
                        <option value="IT">IT</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Facilities">Facilities</option>
                        <option value="Administration">Administration</option>
                      </select>
                    </label>

                    <label>
                      Priority
                      <select
                        name="priority"
                        value={complaintForm.priority}
                        onChange={handleComplaintChange}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>
                    </label>
                  </div>

                  <button type="submit" className="primary-btn">
                    Submit Complaint
                  </button>
                </form>
              </section>

              <section className="card">
                <h2>My Complaints</h2>
                <div className="complaint-list">
                  {complaints.length === 0 ? (
                    <p>No complaints submitted yet.</p>
                  ) : (
                    complaints.map((complaint) => (
                      <div key={complaint._id} className="complaint-item">
                        <div className="complaint-header">
                          <div>
                            <p className="muted">#{complaint._id.slice(-6)}</p>
                            <h3>{complaint.title}</h3>
                          </div>
                          <span className={statusClass(complaint.status)}>
                            {complaint.status}
                          </span>
                        </div>

                        <div className="complaint-meta">
                          <span className={priorityClass(complaint.priority)}>
                            {complaint.priority}
                          </span>
                          <span>{complaint.category}</span>
                          <span>{formatDate(complaint.createdAt)}</span>
                        </div>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => handleViewComplaint(complaint)}
                        >
                          View Details
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {selectedComplaint && (
                <section ref={detailsRef} className="card detail-card">
                  <h2>Complaint Details</h2>
                  <div className="detail-grid">
                    <div>
                      <p>
                        <strong>Title:</strong> {selectedComplaint.title}
                      </p>
                      <p>
                        <strong>Description:</strong>{" "}
                        {selectedComplaint.description}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Category:</strong> {selectedComplaint.category}
                      </p>
                      <p>
                        <strong>Priority:</strong>{" "}
                        <span
                          className={priorityClass(selectedComplaint.priority)}
                        >
                          {selectedComplaint.priority}
                        </span>
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span className={statusClass(selectedComplaint.status)}>
                          {selectedComplaint.status}
                        </span>
                      </p>
                      <p>
                        <strong>Assigned to:</strong>{" "}
                        {selectedComplaint.assignedTo
                          ? selectedComplaint.assignedTo.name
                          : "Not assigned yet"}
                      </p>
                      <p>
                        <strong>Resolution:</strong>{" "}
                        {selectedComplaint.resolutionComment ||
                          "Not resolved yet"}
                      </p>
                      <p>
                        <strong>Created:</strong>{" "}
                        {formatDate(selectedComplaint.createdAt)}
                      </p>
                      <p>
                        <strong>Updated:</strong>{" "}
                        {formatDate(selectedComplaint.updatedAt)}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="stats-grid">
                <div className="stat-card">
                  <span>Total</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="stat-card">
                  <span>Submitted</span>
                  <strong>{stats.submitted}</strong>
                </div>
                <div className="stat-card">
                  <span>Assigned</span>
                  <strong>{stats.assigned}</strong>
                </div>
                <div className="stat-card">
                  <span>In Progress</span>
                  <strong>{stats.inProgress}</strong>
                </div>
                <div className="stat-card">
                  <span>Resolved</span>
                  <strong>{stats.resolved}</strong>
                </div>
              </section>

              <section className="card">
                <h2>All Complaints</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Submitted By</th>
                        <th>Assigned To</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaints.length === 0 ? (
                        <tr>
                          <td colSpan="9">No complaints available.</td>
                        </tr>
                      ) : (
                        complaints.map((complaint) => (
                          <tr
                            key={complaint._id}
                            className={
                              selectedComplaintId === complaint._id
                                ? "selected-row"
                                : ""
                            }
                          >
                            <td>#{complaint._id.slice(-6)}</td>
                            <td>{complaint.title}</td>
                            <td>{complaint.category}</td>
                            <td>
                              <span
                                className={priorityClass(complaint.priority)}
                              >
                                {complaint.priority}
                              </span>
                            </td>
                            <td>{complaint.submittedBy?.name || "—"}</td>
                            <td>
                              {complaint.assignedTo?.name || "Unassigned"}
                            </td>
                            <td>
                              <span className={statusClass(complaint.status)}>
                                {complaint.status}
                              </span>
                            </td>
                            <td>{formatDate(complaint.createdAt)}</td>
                            <td>
                              <div className="row-action">
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => handleViewComplaint(complaint)}
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedComplaint && (
                <section
                  ref={detailsRef}
                  className="card detail-card"
                  id="admin-complaint-details"
                >
                  <h2>Complaint Details</h2>
                  <div className="detail-grid">
                    <div>
                      <p>
                        <strong>Complaint ID:</strong> {selectedComplaint._id}
                      </p>
                      <p>
                        <strong>Title:</strong> {selectedComplaint.title}
                      </p>
                      <p>
                        <strong>Description:</strong>{" "}
                        {selectedComplaint.description}
                      </p>
                      <p>
                        <strong>Category:</strong> {selectedComplaint.category}
                      </p>
                      <p>
                        <strong>Priority:</strong>{" "}
                        <span
                          className={priorityClass(selectedComplaint.priority)}
                        >
                          {selectedComplaint.priority}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span className={statusClass(selectedComplaint.status)}>
                          {selectedComplaint.status}
                        </span>
                      </p>
                      <p>
                        <strong>Submitted by:</strong>{" "}
                        {selectedComplaint.submittedBy?.name || "Unknown"}
                      </p>
                      <p>
                        <strong>Assigned to:</strong>{" "}
                        {selectedComplaint.assignedTo
                          ? `${selectedComplaint.assignedTo.name} — ${selectedComplaint.assignedTo.email}`
                          : "Unassigned"}
                      </p>
                      <p>
                        <strong>Resolution:</strong>{" "}
                        {selectedComplaint.resolutionComment ||
                          "Not resolved yet"}
                      </p>
                      <p>
                        <strong>Created:</strong>{" "}
                        {formatDate(selectedComplaint.createdAt)}
                      </p>
                      <p>
                        <strong>Updated:</strong>{" "}
                        {formatDate(selectedComplaint.updatedAt)}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {selectedComplaint && (
                <section className="card complaint-actions-card">
                  <h2>Complaint Actions</h2>
                  <div className="action-groups">
                    <section className="action-group">
                      <h3>Assignment</h3>
                      <div className="action-controls">
                        <select
                          value={assignmentUserId}
                          onChange={(event) =>
                            setAssignmentUserId(event.target.value)
                          }
                          aria-label="Assign complaint to user"
                          disabled={
                            isLoadingUsers ||
                            users.length === 0 ||
                            selectedComplaint.status === "RESOLVED"
                          }
                        >
                          <option value="">
                            {isLoadingUsers
                              ? "Loading users..."
                              : "Select a user..."}
                          </option>
                          {users.map((candidate) => (
                            <option key={candidate._id} value={candidate._id}>
                              {candidate.name} — {candidate.email}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={
                            isAssigning ||
                            !users.some(
                              (candidate) => candidate._id === assignmentUserId,
                            ) ||
                            selectedComplaint.status === "RESOLVED"
                          }
                          onClick={() =>
                            handleAssignComplaint(
                              selectedComplaint._id,
                              assignmentUserId,
                            )
                          }
                        >
                          {isAssigning ? "Assigning..." : "Assign"}
                        </button>
                      </div>
                    </section>

                    <section className="action-group">
                      <h3>Status</h3>
                      <div className="action-controls">
                        <select
                          value={nextStatus}
                          onChange={(event) =>
                            setNextStatus(event.target.value)
                          }
                          aria-label="Complaint status"
                        >
                          <option value="SUBMITTED">SUBMITTED</option>
                          <option value="ASSIGNED">ASSIGNED</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            handleStatusUpdate(
                              selectedComplaint._id,
                              nextStatus,
                            )
                          }
                        >
                          Change Status
                        </button>
                      </div>
                    </section>

                    <section className="action-group">
                      <h3>Resolution</h3>
                      <div className="action-controls">
                        <input
                          type="text"
                          value={resolutionComment}
                          onChange={(event) =>
                            setResolutionComment(event.target.value)
                          }
                          placeholder="Add resolution comment"
                          aria-label="Resolution comment"
                        />
                        <button
                          type="button"
                          className="resolve-btn"
                          onClick={() =>
                            handleResolveComplaint(
                              selectedComplaint._id,
                              resolutionComment,
                            )
                          }
                        >
                          Resolve
                        </button>
                      </div>
                    </section>
                  </div>

                  <section className="danger-zone">
                    <div>
                      <h3>Danger Zone</h3>
                      <p>Delete this complaint permanently.</p>
                    </div>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() =>
                        handleDeleteComplaint(selectedComplaint._id)
                      }
                    >
                      Delete Complaint
                    </button>
                  </section>
                </section>
              )}
            </>
          )}

          {message && <p className="success float-message">{message}</p>}
          {error && <p className="error float-message">{error}</p>}
        </main>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
