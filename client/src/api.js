const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(endpoint, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const authApi = {
  register: (payload) =>
    request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  getMe: (token) => request("/auth/me", { token }),
};

export const userApi = {
  getUsers: (token) => request("/users", { token }),
};

export const complaintApi = {
  getComplaints: (token) => request("/complaints", { token }),
  createComplaint: (payload, token) =>
    request("/complaints", { method: "POST", body: payload, token }),
  getComplaintById: (id, token) => request(`/complaints/${id}`, { token }),
  updateComplaint: (id, payload, token) =>
    request(`/complaints/${id}`, { method: "PUT", body: payload, token }),
  assignComplaint: (id, payload, token) =>
    request(`/complaints/${id}/assign`, {
      method: "PUT",
      body: payload,
      token,
    }),
  updateStatus: (id, payload, token) =>
    request(`/complaints/${id}/status`, {
      method: "PUT",
      body: payload,
      token,
    }),
  resolveComplaint: (id, payload, token) =>
    request(`/complaints/${id}/resolve`, {
      method: "PUT",
      body: payload,
      token,
    }),
  deleteComplaint: (id, token) =>
    request(`/complaints/${id}`, { method: "DELETE", token }),
};

export default API_URL;
