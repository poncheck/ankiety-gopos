import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getResponse } from "./api/admin.js";

const s = {
  header: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" },
  backBtn: { background: "none", border: "1.5px solid #d1d5db", borderRadius: "8px", padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.875rem" },
  title: { fontSize: "1.5rem", fontWeight: 700 },
  meta: {
    background: "#f8fafc",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1.5rem",
    fontSize: "0.875rem",
    color: "#374151",
    display: "flex",
    gap: "2rem",
  },
  metaItem: { display: "flex", flexDirection: "column", gap: "2px" },
  metaLabel: { fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" },
  metaValue: { fontWeight: 600, color: "#111827" },
  productBlock: {
    background: "#fff",
    borderRadius: "10px",
    marginBottom: "1rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    overflow: "hidden",
  },
  productHeader: {
    background: "#f1f5f9",
    padding: "0.75rem 1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  productIcon: { fontSize: "1rem" },
  productName: { fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" },
  answerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.65rem 1.25rem",
    borderTop: "1px solid #f1f5f9",
  },
  questionText: { color: "#374151", fontSize: "0.875rem" },
  answerValue: {
    fontWeight: 600,
    color: "#111827",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "6px",
    padding: "0.2rem 0.65rem",
    fontSize: "0.85rem",
  },
  empty: { color: "#6b7280", fontStyle: "italic", padding: "1.25rem", fontSize: "0.875rem" },
  err: { color: "#dc2626" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL");
}

function formatValue(value) {
  // Ładniejszy display dla znanych wartości
  if (value === "Tak") return "✓ Tak";
  if (value === "Nie") return "✗ Nie";
  const num = Number(value);
  if (!isNaN(num) && num >= 1 && num <= 5) return `${"★".repeat(num)}${"☆".repeat(5 - num)} (${num}/5)`;
  return value;
}

export default function ResponseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResponse(id).then(setResponse).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p style={s.err}>{error}</p>;
  if (!response) return <p>Ładowanie...</p>;

  // Grupuj odpowiedzi po produkcie, zachowując kolejność pierwszego wystąpienia
  const productOrder = [];
  const byProduct = {};
  for (const ans of response.answers) {
    if (!byProduct[ans.product_id]) {
      productOrder.push(ans.product_id);
      byProduct[ans.product_id] = {
        name: ans.product_name || null,
        answers: [],
      };
    }
    byProduct[ans.product_id].answers.push(ans);
  }

  return (
    <div>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/admin/responses")}>← Powrót</button>
        <h1 style={s.title}>Ankieta #{response.id}</h1>
      </div>

      <div style={s.meta}>
        <div style={s.metaItem}>
          <span style={s.metaLabel}>Nr paragonu</span>
          <span style={s.metaValue}>#{response.fiscal_ref_id}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaLabel}>Data wypełnienia</span>
          <span style={s.metaValue}>{formatDate(response.created_at)}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaLabel}>Produktów ocenionych</span>
          <span style={s.metaValue}>{productOrder.length}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaLabel}>Odpowiedzi łącznie</span>
          <span style={s.metaValue}>{response.answers.length}</span>
        </div>
      </div>

      {productOrder.length === 0 && (
        <p style={s.empty}>Brak odpowiedzi w tej ankiecie.</p>
      )}

      {productOrder.map((pid) => {
        const { name, answers } = byProduct[pid];
        return (
          <div key={pid} style={s.productBlock}>
            <div style={s.productHeader}>
              <span style={s.productIcon}>☕</span>
              <span style={s.productName}>{name || <span style={{ color: "#94a3b8", fontWeight: 400 }}>ID: {pid}</span>}</span>
            </div>
            {answers.map((a) => (
              <div key={a.id} style={s.answerRow}>
                <span style={s.questionText}>{a.question_text}</span>
                <span style={s.answerValue}>{formatValue(a.value)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
