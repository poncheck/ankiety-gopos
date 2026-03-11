import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories, syncCategories } from "./api/admin.js";

const s = {
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" },
  title: { fontSize: "1.5rem", fontWeight: 700 },
  syncBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "0.6rem 1.2rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  th: { background: "#f8fafc", padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem" },
  link: { color: "#2563eb", textDecoration: "none", fontWeight: 500 },
  msg: { marginTop: "1rem", padding: "0.75rem", borderRadius: "8px", background: "#dcfce7", color: "#166534", fontSize: "0.875rem" },
  err: { marginTop: "1rem", padding: "0.75rem", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", fontSize: "0.875rem" },
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const result = await syncCategories();
      setSyncMsg(`Dodano: ${result.added}, zaktualizowano: ${result.updated}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Kategorie</h1>
        <button style={s.syncBtn} onClick={handleSync} disabled={syncing}>
          {syncing ? "Synchronizuję..." : "Synchronizuj z GoPOS"}
        </button>
      </div>

      {syncMsg && <div style={s.msg}>{syncMsg}</div>}
      {error && <div style={s.err}>{error}</div>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Nazwa</th>
            <th style={s.th}>GoPOS ID</th>
            <th style={s.th}>Pytania</th>
            <th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 && (
            <tr>
              <td style={s.td} colSpan={4} align="center">Brak kategorii — kliknij Synchronizuj</td>
            </tr>
          )}
          {categories.map((cat) => (
            <tr key={cat.id}>
              <td style={s.td}>{cat.name}</td>
              <td style={s.td}>{cat.gopos_id}</td>
              <td style={s.td}>{cat.question_count}</td>
              <td style={s.td}>
                <Link to={`/admin/categories/${cat.id}/questions`} style={s.link}>
                  Zarządzaj pytaniami
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
