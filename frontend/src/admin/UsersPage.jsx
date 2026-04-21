import { useState, useEffect } from "react";
import { getUsers, createUser, deleteUser, changePassword } from "./api/admin.js";

const s = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" },
  title: { fontSize: "1.6rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  card: { background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: "2rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "0.9rem 1rem", borderBottom: "1px solid #f1f5f9", color: "#1e293b", verticalAlign: "middle" },
  badge: { display: "inline-block", padding: "0.2rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, background: "#dcfce7", color: "#16a34a" },
  btnDanger: { background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" },
  btnSm: { background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.85rem" },
  form: { background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "1.5rem" },
  formTitle: { fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem" },
  row: { display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1, minWidth: "160px" },
  label: { fontSize: "0.8rem", fontWeight: 500, color: "#64748b" },
  input: { padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.95rem", outline: "none" },
  btnPrimary: { background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "0.6rem 1.2rem", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" },
  err: { marginTop: "0.75rem", padding: "0.6rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "0.9rem" },
  ok: { marginTop: "0.75rem", padding: "0.6rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#15803d", fontSize: "0.9rem" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modalBox: { background: "#fff", borderRadius: "12px", padding: "1.5rem", width: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
  modalTitle: { fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem" },
  modalBtns: { display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" },
};

function PasswordModal({ user, onClose }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (pwd.length < 8) { setErr("Hasło musi mieć min. 8 znaków"); return; }
    setSaving(true); setErr(null);
    try {
      await changePassword(user.id, pwd);
      setOk(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalTitle}>Zmień hasło — {user.username}</div>
        <input
          style={s.input}
          type="password"
          placeholder="Nowe hasło (min. 8 znaków)"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          autoFocus
        />
        {err && <div style={s.err}>{err}</div>}
        {ok && <div style={s.ok}>Hasło zmienione!</div>}
        <div style={s.modalBtns}>
          <button style={s.btnSm} onClick={onClose}>Anuluj</button>
          <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "Zapisuję..." : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState(null);
  const [pwdModal, setPwdModal] = useState(null);

  async function load() {
    try {
      setUsers(await getUsers());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAddErr(null);
    if (!username.trim()) { setAddErr("Podaj nazwę użytkownika"); return; }
    if (password.length < 8) { setAddErr("Hasło musi mieć min. 8 znaków"); return; }
    setAdding(true);
    try {
      await createUser(username.trim(), password);
      setUsername(""); setPassword("");
      setMsg("Użytkownik dodany");
      setTimeout(() => setMsg(null), 3000);
      await load();
    } catch (e) {
      setAddErr(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Usunąć użytkownika "${user.username}"?`)) return;
    try {
      await deleteUser(user.id);
      setMsg("Użytkownik usunięty");
      setTimeout(() => setMsg(null), 3000);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {pwdModal && <PasswordModal user={pwdModal} onClose={() => { setPwdModal(null); load(); }} />}

      <div style={s.header}>
        <h1 style={s.title}>Użytkownicy</h1>
      </div>

      {error && <div style={s.err}>{error}</div>}
      {msg && <div style={s.ok}>{msg}</div>}

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Użytkownik</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Utworzony</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td style={s.td} colSpan={4} align="center">Brak użytkowników</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td style={s.td}><strong>{u.username}</strong></td>
                <td style={s.td}><span style={s.badge}>Aktywny</span></td>
                <td style={{ ...s.td, color: "#64748b", fontSize: "0.9rem" }}>
                  {new Date(u.created_at).toLocaleDateString("pl-PL")}
                </td>
                <td style={{ ...s.td, display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button style={s.btnSm} onClick={() => setPwdModal(u)}>Zmień hasło</button>
                  <button style={s.btnDanger} onClick={() => handleDelete(u)}>Usuń</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.form}>
        <div style={s.formTitle}>Dodaj użytkownika</div>
        <form onSubmit={handleAdd}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Nazwa użytkownika</label>
              <input style={s.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="np. barista1" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Hasło (min. 8 znaków)</label>
              <input style={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button style={s.btnPrimary} type="submit" disabled={adding}>
              {adding ? "Dodaję..." : "Dodaj"}
            </button>
          </div>
          {addErr && <div style={s.err}>{addErr}</div>}
        </form>
      </div>
    </div>
  );
}
