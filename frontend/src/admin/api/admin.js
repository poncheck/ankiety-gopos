const BASE = "/api/admin";

function getToken() {
  return localStorage.getItem("admin_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/login";
    throw new Error("Sesja wygasła");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Błąd ${res.status}`);
  }

  return res.json();
}

export async function login(username, password) {
  const data = await fetch(BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!data.ok) throw new Error("Błędne dane logowania");
  const json = await data.json();
  localStorage.setItem("admin_token", json.access_token);
}

export const getCategories = () => apiFetch("/categories");
export const syncCategories = () => apiFetch("/categories/sync", { method: "POST" });

export const getQuestions = (categoryId) => apiFetch(`/categories/${categoryId}/questions`);
export const createQuestion = (categoryId, body) =>
  apiFetch(`/categories/${categoryId}/questions`, { method: "POST", body: JSON.stringify(body) });
export const updateQuestion = (id, body) =>
  apiFetch(`/questions/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteQuestion = (id) => apiFetch(`/questions/${id}`, { method: "DELETE" });

export const getResponses = (page = 0) => apiFetch(`/responses?page=${page}&size=20`);
export const getResponse = (id) => apiFetch(`/responses/${id}`);
export const getProductStats = () => apiFetch("/stats/products");
export const getMarketingEmails = () => apiFetch("/marketing-emails");

// --- Settings helpers ---
async function uploadFile(path, file) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/login";
    throw new Error("Sesja wygasła");
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "Błąd przesyłania");
  }
  return res.json();
}

export const getAdminSettings = () => apiFetch("/settings");
export const updateInstructions = (text) =>
  apiFetch("/settings/instructions", { method: "PUT", body: JSON.stringify({ text }) });
export const uploadLogo = (file) => uploadFile("/settings/logo", file);
export const deleteLogo = () => apiFetch("/settings/logo", { method: "DELETE" });
export const uploadReceiptImage = (file) => uploadFile("/settings/receipt-image", file);
export const deleteReceiptImage = () => apiFetch("/settings/receipt-image", { method: "DELETE" });

// --- Import pytań ---
export const importQuestions = (text) =>
  apiFetch("/import/questions", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  });

// --- Użytkownicy ---
export const getUsers = () => apiFetch("/users");
export const createUser = (username, password) =>
  apiFetch("/users", { method: "POST", body: JSON.stringify({ username, password }) });
export const deleteUser = (id) => apiFetch(`/users/${id}`, { method: "DELETE" });
export const changePassword = (id, new_password) =>
  apiFetch(`/users/${id}/password`, { method: "PUT", body: JSON.stringify({ new_password }) });
