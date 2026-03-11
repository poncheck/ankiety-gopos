import { useState } from "react";

const styles = {
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
    width: "100%",
    maxWidth: "400px",
  },
  logo: {
    display: "block",
    maxWidth: "180px",
    maxHeight: "80px",
    objectFit: "contain",
    margin: "0 auto 1.25rem",
  },
  title: { fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" },
  subtitle: { color: "#666", marginBottom: "0.75rem", fontSize: "0.95rem" },
  instructions: {
    color: "#374151",
    fontSize: "0.875rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "0.65rem 0.9rem",
    marginBottom: "1.25rem",
    lineHeight: 1.5,
  },
  label: { display: "block", fontWeight: 600, marginBottom: "0.4rem" },
  hintBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: "0.8rem",
    cursor: "pointer",
    padding: "0 0 0.5rem",
    textDecoration: "underline",
  },
  hintImg: {
    display: "block",
    maxWidth: "100%",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    marginBottom: "0.75rem",
  },
  input: {
    width: "100%",
    padding: "0.65rem 0.9rem",
    borderRadius: "8px",
    border: "1.5px solid #ccc",
    fontSize: "1rem",
    outline: "none",
    marginBottom: "1rem",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "0.75rem",
    borderRadius: "8px",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
  },
};

export default function ReceiptForm({ onSubmit, loading, error, settings = {} }) {
  const [billNumber, setBillNumber] = useState("");
  const [hintOpen, setHintOpen] = useState(false);

  const { logo_url, receipt_image_url, receipt_instructions } = settings;

  function handleSubmit(e) {
    e.preventDefault();
    if (billNumber.trim()) onSubmit(billNumber.trim());
  }

  return (
    <div style={styles.card}>
      {logo_url && <img src={logo_url} alt="Logo" style={styles.logo} />}
      <h1 style={styles.title}>Oceń swoje zamówienie</h1>
      <p style={styles.subtitle}>
        Podaj numer paragonu, aby rozpocząć ankietę.
      </p>
      {receipt_instructions && (
        <p style={styles.instructions}>{receipt_instructions}</p>
      )}
      <form onSubmit={handleSubmit}>
        <label htmlFor="bill" style={styles.label}>
          Numer paragonu
        </label>
        {receipt_image_url && (
          <>
            <button
              type="button"
              style={styles.hintBtn}
              onClick={() => setHintOpen((o) => !o)}
            >
              Pokaż przykładowy paragon {hintOpen ? "▲" : "▼"}
            </button>
            {hintOpen && (
              <img src={receipt_image_url} alt="Przykładowy paragon" style={styles.hintImg} />
            )}
          </>
        )}
        <input
          id="bill"
          style={styles.input}
          type="text"
          placeholder="np. 12345"
          value={billNumber}
          onChange={(e) => setBillNumber(e.target.value)}
          disabled={loading}
          autoFocus
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={loading || !billNumber.trim()}>
          {loading ? "Ładowanie..." : "Sprawdź paragon"}
        </button>
      </form>
    </div>
  );
}
