import { useState, useRef } from "react";
import { importQuestions } from "./api/admin";

const TEMPLATE = `# Ankiety GoPOS — szablon importu pytań
# ─────────────────────────────────────────
# Format każdego pytania:
#   Treść pytania | typ
#
# Dostępne typy:
#   ocena          — skala 1–5 gwiazdek
#   tak/nie        — odpowiedź binarna
#   tekst          — pole tekstowe
#   wybor: A, B, C — wybór z listy opcji
#
# Linie zaczynające się od # są ignorowane.
# Linie --- są ignorowane (separator dla czytelności).
# ─────────────────────────────────────────

KATEGORIA: Desery
---
Jak oceniasz smak deseru? | ocena
Czy polecasz nasz deser znajomym? | tak/nie
Co możemy poprawić w deserze? | tekst
Jak oceniasz wygląd deseru? | wybor: Świetny, Dobry, Przeciętny, Słaby

KATEGORIA: Napoje
---
Jak oceniasz smak napoju? | ocena
Czy napój był dobrze schłodzony? | tak/nie
`;

const s = {
  page: { padding: "32px", maxWidth: 740, margin: "0 auto" },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 6, color: "#1e293b" },
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 12 },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  btnSecondary: {
    padding: "8px 14px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "#334155",
    fontWeight: 500,
  },
  btnPrimary: {
    padding: "10px 24px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    color: "#fff",
    fontWeight: 600,
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  textarea: {
    width: "100%",
    minHeight: 320,
    padding: "12px 14px",
    fontSize: 13,
    fontFamily: "monospace",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    resize: "vertical",
    lineHeight: 1.6,
    boxSizing: "border-box",
    outline: "none",
    color: "#1e293b",
  },
  resultOk: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 8,
    padding: "14px 18px",
    color: "#166534",
    fontSize: 14,
  },
  resultErr: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    padding: "14px 18px",
    color: "#991b1b",
    fontSize: 14,
  },
  errList: { margin: "8px 0 0", paddingLeft: 18, fontSize: 13 },
  errItem: { marginBottom: 4 },
  hint: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.7,
    fontFamily: "monospace",
  },
};

export default function ImportPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {imported, skipped, errors}
  const fileRef = useRef(null);

  function handleDownloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "szablon_pytan.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileLoad(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result || "");
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await importQuestions(text);
      setResult(res);
    } catch (err) {
      setResult({ imported: 0, skipped: 0, errors: [{ line: "—", message: err.message }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.heading}>Import pytań</div>
      <div style={s.sub}>
        Wklej lub wgraj plik .txt z pytaniami. Pytania zostaną przypisane do istniejących kategorii.
      </div>

      {/* Format */}
      <div style={s.card}>
        <div style={s.cardTitle}>Format pliku</div>
        <div style={s.hint}>
          {`KATEGORIA: Nazwa kategorii\n`}
          {`Treść pytania | ocena\n`}
          {`Treść pytania | tak/nie\n`}
          {`Treść pytania | tekst\n`}
          {`Treść pytania | wybor: Opcja A, Opcja B, Opcja C`}
        </div>
      </div>

      {/* Akcje */}
      <div style={s.card}>
        <div style={s.cardTitle}>Treść importu</div>
        <div style={s.btnRow}>
          <button style={s.btnSecondary} onClick={handleDownloadTemplate}>
            ⬇ Pobierz szablon .txt
          </button>
          <button style={s.btnSecondary} onClick={() => fileRef.current?.click()}>
            📂 Wgraj plik .txt
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            style={{ display: "none" }}
            onChange={handleFileLoad}
          />
        </div>
        <textarea
          style={s.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`KATEGORIA: Desery\nJak oceniasz smak? | ocena\nCzy polecasz? | tak/nie`}
          spellCheck={false}
        />
      </div>

      {/* Importuj */}
      <button
        style={{ ...s.btnPrimary, ...(busy || !text.trim() ? s.btnDisabled : {}) }}
        disabled={busy || !text.trim()}
        onClick={handleImport}
      >
        {busy ? "Importowanie…" : "Importuj pytania"}
      </button>

      {/* Wynik */}
      {result && (
        <div style={{ marginTop: 20 }}>
          {result.imported > 0 && (
            <div style={s.resultOk}>
              ✓ Zaimportowano <strong>{result.imported}</strong> pytań
              {result.skipped > 0 && `, pominięto ${result.skipped}`}
            </div>
          )}
          {result.imported === 0 && result.errors.length === 0 && (
            <div style={s.resultErr}>Nie znaleziono żadnych pytań do importu.</div>
          )}
          {result.errors.length > 0 && (
            <div style={{ ...s.resultErr, marginTop: result.imported > 0 ? 10 : 0 }}>
              <strong>Błędy ({result.errors.length}):</strong>
              <ul style={s.errList}>
                {result.errors.map((e, i) => (
                  <li key={i} style={s.errItem}>
                    Linia {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
