import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./api/admin.js";

const s = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2.5rem",
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
    width: "100%",
    maxWidth: "380px",
  },
  title: { fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" },
  label: { display: "block", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.875rem" },
  input: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "1rem",
    marginBottom: "1rem",
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "0.75rem",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#dc2626", fontSize: "0.875rem", marginTop: "0.75rem" },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>Panel admina</h1>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Login</label>
          <input
            style={s.input}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
          <label style={s.label}>Hasło</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
          {error && <p style={s.error}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
