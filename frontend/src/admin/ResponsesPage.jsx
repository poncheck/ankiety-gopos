import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getResponses, getProductStats, getMarketingEmails } from "./api/admin.js";

// ─── Style ────────────────────────────────────────────────────────────────────

const s = {
  // Tabs
  tabBar: { display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "2px solid #e2e8f0" },
  tab: {
    padding: "0.6rem 1.25rem",
    border: "none",
    borderBottom: "2px solid transparent",
    marginBottom: "-2px",
    background: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#64748b",
  },
  tabActive: {
    padding: "0.6rem 1.25rem",
    border: "none",
    borderBottom: "2px solid #2563eb",
    marginBottom: "-2px",
    background: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#2563eb",
  },
  // Header
  header: { display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1.5rem" },
  title: { fontSize: "1.5rem", fontWeight: 700 },
  count: { fontSize: "1rem", color: "#6b7280" },

  // Receipt cards
  card: {
    background: "#fff",
    borderRadius: "10px",
    padding: "1rem 1.25rem",
    marginBottom: "0.75rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  receiptBadge: {
    background: "#f1f5f9",
    borderRadius: "8px",
    padding: "0.5rem 0.9rem",
    fontWeight: 700,
    minWidth: "100px",
    textAlign: "center",
    flexShrink: 0,
  },
  receiptLabel: { fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: "2px" },
  receiptNum: { fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" },
  info: { flex: 1 },
  date: { fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.4rem" },
  products: { display: "flex", flexWrap: "wrap", gap: "0.35rem" },
  productTag: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "20px",
    padding: "0.2rem 0.65rem",
    fontSize: "0.78rem",
    fontWeight: 500,
  },
  noProducts: { color: "#9ca3af", fontSize: "0.8rem", fontStyle: "italic" },
  right: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 },
  answerCount: { fontSize: "0.8rem", color: "#6b7280" },
  detailLink: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: "6px",
    padding: "0.35rem 0.85rem",
    textDecoration: "none",
    fontSize: "0.82rem",
    fontWeight: 600,
  },
  pagination: { display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" },
  pgBtn: { border: "1.5px solid #d1d5db", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", background: "#fff", fontSize: "0.875rem" },
  pgBtnActive: { border: "1.5px solid #2563eb", borderRadius: "6px", padding: "0.35rem 0.8rem", cursor: "pointer", background: "#2563eb", color: "#fff", fontSize: "0.875rem" },

  // Stats
  statCard: {
    background: "#fff",
    borderRadius: "10px",
    marginBottom: "1rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    overflow: "hidden",
  },
  statHeader: {
    background: "#f8fafc",
    padding: "0.85rem 1.25rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
  },
  statProductName: { fontWeight: 700, fontSize: "1rem", color: "#1e293b" },
  statTotal: { fontSize: "0.78rem", color: "#64748b", background: "#e2e8f0", borderRadius: "20px", padding: "0.15rem 0.6rem" },
  statBody: { padding: "0.75rem 1.25rem" },
  questionBlock: { marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" },
  questionLabel: { fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" },

  // Rating
  ratingRow: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" },
  ratingAvg: { fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" },
  ratingStars: { fontSize: "1.1rem", color: "#f59e0b" },
  ratingBarRow: { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", marginBottom: "3px" },
  ratingBarLabel: { width: "14px", color: "#6b7280", textAlign: "right" },
  ratingBar: { height: "8px", borderRadius: "4px", background: "#fef3c7", flex: 1, overflow: "hidden" },
  ratingBarFill: { height: "100%", background: "#f59e0b", borderRadius: "4px" },
  ratingBarCount: { color: "#6b7280", minWidth: "28px" },

  // Yesno / choice bar
  boolRow: { display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem", fontSize: "0.82rem" },
  boolLabel: { width: "36px", fontWeight: 600 },
  boolBarWrap: { flex: 1, height: "14px", background: "#f1f5f9", borderRadius: "7px", overflow: "hidden" },
  boolBarFillYes: { height: "100%", background: "#22c55e", borderRadius: "7px" },
  boolBarFillNo: { height: "100%", background: "#ef4444", borderRadius: "7px" },
  boolBarFillOther: { height: "100%", background: "#6366f1", borderRadius: "7px" },
  boolCount: { color: "#6b7280", minWidth: "40px" },

  // Text answers
  textList: { listStyle: "none", padding: 0, margin: 0 },
  textItem: {
    fontSize: "0.82rem",
    color: "#374151",
    padding: "0.35rem 0.6rem",
    background: "#f8fafc",
    borderRadius: "6px",
    marginBottom: "4px",
    borderLeft: "3px solid #e2e8f0",
  },
  showMore: { background: "none", border: "none", color: "#2563eb", fontSize: "0.78rem", cursor: "pointer", padding: "2px 0", fontWeight: 500 },

  empty: { color: "#6b7280", textAlign: "center", padding: "3rem 0" },
  err: { color: "#dc2626", fontSize: "0.875rem" },

  // Email badges on cards
  emailBadge: {
    display: "inline-flex", alignItems: "center", gap: "0.3rem",
    fontSize: "0.75rem", color: "#374151",
    background: "#f1f5f9", borderRadius: "20px",
    padding: "0.15rem 0.55rem", marginTop: "0.35rem",
  },
  consentBadge: {
    display: "inline-flex", alignItems: "center", gap: "0.3rem",
    fontSize: "0.72rem", fontWeight: 600,
    background: "#dcfce7", color: "#15803d",
    borderRadius: "20px", padding: "0.15rem 0.55rem", marginLeft: "0.35rem",
  },

  // Marketing tab
  mktCard: {
    background: "#fff", borderRadius: "10px", padding: "0.85rem 1.25rem",
    marginBottom: "0.6rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  mktEmail: { fontWeight: 600, color: "#111827", fontSize: "0.95rem" },
  mktDate: { fontSize: "0.78rem", color: "#6b7280" },
  copyBtn: {
    border: "1.5px solid #d1d5db", borderRadius: "6px", padding: "0.3rem 0.75rem",
    cursor: "pointer", background: "#fff", fontSize: "0.8rem", fontWeight: 600, color: "#374151",
  },
  mktSummary: {
    background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px",
    padding: "1rem 1.25rem", marginBottom: "1.25rem", fontSize: "0.875rem", color: "#15803d",
    display: "flex", alignItems: "center", gap: "0.75rem",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function detectType(answers) {
  const keys = Object.keys(answers);
  const numericRating = keys.every((k) => ["1", "2", "3", "4", "5"].includes(k));
  if (numericRating) return "rating";
  const yesno = keys.length <= 2 && keys.every((k) => ["Tak", "Nie"].includes(k));
  if (yesno) return "yesno";
  return "other"; // choice lub text
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingStats({ answers, avg, total }) {
  const maxCount = Math.max(...Object.values(answers));
  return (
    <div>
      <div style={s.ratingRow}>
        <span style={s.ratingAvg}>{avg}</span>
        <span style={s.ratingStars}>{"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}</span>
        <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>({total} {total === 1 ? "ocena" : "ocen"})</span>
      </div>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = answers[String(star)] || 0;
        return (
          <div key={star} style={s.ratingBarRow}>
            <span style={s.ratingBarLabel}>{star}</span>
            <div style={s.ratingBar}>
              <div style={{ ...s.ratingBarFill, width: maxCount ? `${(count / maxCount) * 100}%` : "0%" }} />
            </div>
            <span style={s.ratingBarCount}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function BoolStats({ answers, total }) {
  const fillColors = { "Tak": s.boolBarFillYes, "Nie": s.boolBarFillNo };
  return (
    <div>
      {Object.entries(answers)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => (
          <div key={label} style={s.boolRow}>
            <span style={s.boolLabel}>{label}</span>
            <div style={s.boolBarWrap}>
              <div style={{ ...(fillColors[label] || s.boolBarFillOther), width: `${(count / total) * 100}%` }} />
            </div>
            <span style={s.boolCount}>{count} ({Math.round((count / total) * 100)}%)</span>
          </div>
        ))}
    </div>
  );
}

function OtherStats({ answers, total }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(answers).sort((a, b) => b[1] - a[1]);
  const isChoice = entries.length <= 6 && entries.every(([, c]) => c > 1 || entries.length <= 3);

  if (isChoice) {
    return (
      <div>
        {entries.map(([label, count]) => (
          <div key={label} style={s.boolRow}>
            <span style={{ ...s.boolLabel, width: "auto", marginRight: "0.5rem", color: "#374151" }}>{label}</span>
            <div style={s.boolBarWrap}>
              <div style={{ ...s.boolBarFillOther, width: `${(count / total) * 100}%` }} />
            </div>
            <span style={s.boolCount}>{count} ({Math.round((count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    );
  }

  // Text odpowiedzi
  const MAX_VISIBLE = 5;
  const visible = expanded ? entries : entries.slice(0, MAX_VISIBLE);
  return (
    <ul style={s.textList}>
      {visible.map(([text, count], i) => (
        <li key={i} style={s.textItem}>
          {text}{count > 1 && <span style={{ color: "#9ca3af", marginLeft: "0.4rem" }}>×{count}</span>}
        </li>
      ))}
      {entries.length > MAX_VISIBLE && (
        <button style={s.showMore} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Pokaż mniej" : `+ ${entries.length - MAX_VISIBLE} więcej`}
        </button>
      )}
    </ul>
  );
}

function QuestionStats({ question }) {
  const { question_text, answers, total, avg } = question;
  const type = detectType(answers);
  return (
    <div style={s.questionBlock}>
      <div style={s.questionLabel}>{question_text}</div>
      {type === "rating" && <RatingStats answers={answers} avg={avg} total={total} />}
      {type === "yesno" && <BoolStats answers={answers} total={total} />}
      {type === "other" && <OtherStats answers={answers} total={total} />}
    </div>
  );
}

function ProductStatCard({ product }) {
  return (
    <div style={s.statCard}>
      <div style={s.statHeader}>
        <span style={s.statProductName}>{product.product_name}</span>
        <span style={s.statTotal}>{product.total_answers} odpowiedzi</span>
      </div>
      <div style={s.statBody}>
        {product.questions.map((q, i) => (
          <QuestionStats key={i} question={q} />
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Lista paragonów ─────────────────────────────────────────────────────

function ReceiptsTab() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [page, setPage] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResponses(page).then(setData).catch((err) => setError(err.message));
  }, [page]);

  const totalPages = Math.ceil(data.total / 20);

  return (
    <>
      <div style={s.header}>
        <h1 style={s.title}>Paragony z ankietami</h1>
        <span style={s.count}>({data.total})</span>
      </div>
      {error && <p style={s.err}>{error}</p>}
      {data.items.length === 0 && !error && <p style={s.empty}>Brak wypełnionych ankiet.</p>}
      {data.items.map((r) => (
        <div key={r.id} style={s.card}>
          <div style={s.receiptBadge}>
            <div style={s.receiptLabel}>Paragon</div>
            <div style={s.receiptNum}>#{r.fiscal_ref_id}</div>
          </div>
          <div style={s.info}>
            <div style={s.date}>{formatDate(r.created_at)}</div>
            <div style={s.products}>
              {r.products && r.products.length > 0
                ? r.products.map((p) => <span key={p.id} style={s.productTag}>{p.name}</span>)
                : <span style={s.noProducts}>brak nazw produktów</span>}
            </div>
            {r.email && (
              <div style={{ marginTop: "0.4rem" }}>
                <span style={s.emailBadge}>✉ {r.email}</span>
                {r.marketing_consent && <span style={s.consentBadge}>✓ zgoda mkt</span>}
              </div>
            )}
          </div>
          <div style={s.right}>
            <span style={s.answerCount}>{r.answer_count} odp.</span>
            <Link to={`/admin/responses/${r.id}`} style={s.detailLink}>Szczegóły →</Link>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={s.pagination}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} style={i === page ? s.pgBtnActive : s.pgBtn} onClick={() => setPage(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Tab: Zestawienie wg produktów ───────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProductStats().then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <p style={s.err}>{error}</p>;
  if (!stats) return <p style={{ color: "#6b7280" }}>Ładowanie...</p>;
  if (stats.length === 0) return <p style={s.empty}>Brak danych — wypełnij pierwszą ankietę.</p>;

  return (
    <>
      <div style={s.header}>
        <h1 style={s.title}>Zestawienie wg produktów</h1>
        <span style={s.count}>({stats.length} {stats.length === 1 ? "produkt" : "produktów"})</span>
      </div>
      {stats.map((product) => (
        <ProductStatCard key={product.product_name} product={product} />
      ))}
    </>
  );
}

// ─── Tab: E-maile promocyjne ──────────────────────────────────────────────────

function MarketingTab() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMarketingEmails().then(setData).catch((err) => setError(err.message));
  }, []);

  function copyAll() {
    const list = (data?.emails || []).map((e) => e.email).join("\n");
    navigator.clipboard.writeText(list).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error) return <p style={s.err}>{error}</p>;
  if (!data) return <p style={{ color: "#6b7280" }}>Ładowanie...</p>;

  return (
    <>
      <div style={s.header}>
        <h1 style={s.title}>E-maile promocyjne</h1>
        <span style={s.count}>({data.total} unikalnych)</span>
      </div>
      {data.total === 0 ? (
        <p style={s.empty}>Brak klientów z wyrażoną zgodą marketingową.</p>
      ) : (
        <>
          <div style={s.mktSummary}>
            <span style={{ fontSize: "1.3rem" }}>✉</span>
            <span>
              <strong>{data.total}</strong> klientów wyraziło zgodę na otrzymywanie informacji promocyjnych.
              Możesz skopiować wszystkie adresy do swojego narzędzia do wysyłki.
            </span>
            <button style={{ ...s.copyBtn, marginLeft: "auto", background: copied ? "#dcfce7" : "#fff" }} onClick={copyAll}>
              {copied ? "Skopiowano!" : "Kopiuj wszystkie"}
            </button>
          </div>
          {data.emails.map((row) => (
            <div key={row.email} style={s.mktCard}>
              <div>
                <div style={s.mktEmail}>{row.email}</div>
                <div style={s.mktDate}>Ostatnia ankieta: {formatDate(row.last_survey)}</div>
              </div>
              <button
                style={s.copyBtn}
                onClick={() => navigator.clipboard.writeText(row.email)}
              >
                Kopiuj
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResponsesPage() {
  const [activeTab, setActiveTab] = useState("receipts");

  return (
    <div>
      <div style={s.tabBar}>
        <button
          style={activeTab === "receipts" ? s.tabActive : s.tab}
          onClick={() => setActiveTab("receipts")}
        >
          Paragony z ankietami
        </button>
        <button
          style={activeTab === "stats" ? s.tabActive : s.tab}
          onClick={() => setActiveTab("stats")}
        >
          Zestawienie wg produktów
        </button>
        <button
          style={activeTab === "marketing" ? s.tabActive : s.tab}
          onClick={() => setActiveTab("marketing")}
        >
          E-maile promocyjne
        </button>
      </div>

      {activeTab === "receipts" && <ReceiptsTab />}
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "marketing" && <MarketingTab />}
    </div>
  );
}
