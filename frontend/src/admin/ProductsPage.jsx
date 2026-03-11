import { useEffect, useState } from "react";
import { getCategories } from "./api/admin.js";

const BASE = "/api/admin";

function getToken() {
  return localStorage.getItem("admin_token");
}

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Błąd ${res.status}`);
  }
  return res.json();
}

const s = {
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" },
  title: { fontSize: "1.5rem", fontWeight: 700 },
  topBtns: { display: "flex", gap: "0.5rem" },
  syncBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "0.6rem 1.1rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" },
  debugBtn: { background: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", padding: "0.6rem 1.1rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" },
  debugRow: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem" },
  input: { flex: 1, padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.9rem" },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  th: { background: "#f8fafc", padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem" },
  select: { padding: "0.4rem 0.6rem", border: "1.5px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", background: "#fff" },
  saveBtn: { background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 },
  msg: { marginTop: "1rem", marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px", background: "#dcfce7", color: "#166534", fontSize: "0.875rem" },
  err: { marginTop: "1rem", marginBottom: "1rem", padding: "0.75rem", borderRadius: "8px", background: "#fee2e2", color: "#991b1b", fontSize: "0.875rem" },
  debugBox: { background: "#1e1b4b", color: "#c7d2fe", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", fontSize: "0.75rem", fontFamily: "monospace", overflowX: "auto" },
  debugTitle: { fontWeight: 700, marginBottom: "0.75rem", color: "#818cf8" },
  debugItem: { marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #312e81" },
  sectionLabel: { fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem", marginTop: "1.5rem" },
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selections, setSelections] = useState({});
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [debugBill, setDebugBill] = useState("");
  const [debugResult, setDebugResult] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  async function load() {
    try {
      const [prods, cats] = await Promise.all([
        apiFetch("/products"),
        getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
      const sel = {};
      for (const p of prods) {
        sel[p.gopos_product_id] = p.category_id ?? "";
      }
      setSelections(sel);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSyncItems() {
    setSyncing(true);
    setMsg(null);
    setError(null);
    try {
      const result = await apiFetch("/products/sync", { method: "POST" });
      setMsg(`Produkty zsynchronizowane — dodano: ${result.added}, zaktualizowano: ${result.updated}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave(gopos_product_id) {
    setMsg(null);
    setError(null);
    const category_id = selections[gopos_product_id];
    if (!category_id) return;
    try {
      await apiFetch(`/products/${gopos_product_id}/category`, {
        method: "PUT",
        body: JSON.stringify({ category_id: Number(category_id) }),
      });
      setMsg(`Przypisano kategorię`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDebug() {
    if (!debugBill.trim()) return;
    setDebugLoading(true);
    setDebugResult(null);
    setError(null);
    try {
      const data = await apiFetch(`/debug/bill/${debugBill.trim()}`);
      setDebugResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDebugLoading(false);
    }
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>Produkty — przypisanie kategorii</h1>
        <div style={s.topBtns}>
          <button style={s.syncBtn} onClick={handleSyncItems} disabled={syncing}>
            {syncing ? "Synchronizuję..." : "Synchronizuj produkty z GoPOS"}
          </button>
          <button style={s.debugBtn} onClick={() => setShowDebug(!showDebug)}>
            {showDebug ? "Ukryj debug" : "Debug paragonu"}
          </button>
        </div>
      </div>

      {showDebug && (
        <div>
          <div style={s.sectionLabel}>Sprawdź surowe dane GoPOS dla paragonu</div>
          <div style={s.debugRow}>
            <input
              style={s.input}
              placeholder="Numer paragonu (np. 5377)"
              value={debugBill}
              onChange={(e) => setDebugBill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDebug()}
            />
            <button style={s.debugBtn} onClick={handleDebug} disabled={debugLoading}>
              {debugLoading ? "Sprawdzam..." : "Sprawdź"}
            </button>
          </div>

          {debugResult && (
            <div style={s.debugBox}>
              <div style={s.debugTitle}>Wynik dla paragonu {debugBill}:</div>
              {debugResult.map((item, i) => (
                <div key={i} style={s.debugItem}>
                  <strong style={{ color: "#a5b4fc" }}>{item.item_name || "?"}</strong>{" "}
                  (uid={item.item_uid})<br />
                  <span style={{ color: "#fde68a" }}>item_keys:</span> {JSON.stringify(item.item_keys)}<br />
                  <span style={{ color: "#fde68a" }}>item.product_id:</span> {String(item.item_product_id)}{" "}
                  | <span style={{ color: "#fde68a" }}>item.category_id:</span> {String(item.item_category_id)}{" "}
                  | <span style={{ color: "#fde68a" }}>item.category:</span> {JSON.stringify(item.item_category)}<br />
                  <span style={{ color: "#86efac" }}>product_keys:</span> {JSON.stringify(item.product_keys)}{" "}
                  | <span style={{ color: "#86efac" }}>product.category_id:</span> {String(item.product_category_id)}<br />
                  <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                    inne pola itemu: {JSON.stringify(item.item_other_fields)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && <div style={s.msg}>{msg}</div>}
      {error && <div style={s.err}>{error}</div>}

      {products.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          Brak produktów w cache. Kliknij <strong>Synchronizuj produkty z GoPOS</strong> — pobierze
          wszystkie produkty z ich kategoriami. Alternatywnie wpisz numer paragonu w ankiecie.
        </p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Produkt</th>
              <th style={s.th}>GoPOS ID</th>
              <th style={s.th}>Kategoria</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.gopos_product_id}>
                <td style={s.td}>{p.name || "—"}</td>
                <td style={s.td}>{p.gopos_product_id}</td>
                <td style={s.td}>
                  <select
                    style={s.select}
                    value={selections[p.gopos_product_id] ?? ""}
                    onChange={(e) => setSelections({ ...selections, [p.gopos_product_id]: e.target.value })}
                  >
                    <option value="">— brak —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td style={s.td}>
                  <button style={s.saveBtn} onClick={() => handleSave(p.gopos_product_id)}>
                    Zapisz
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
