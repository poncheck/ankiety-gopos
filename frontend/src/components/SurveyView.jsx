import { useState } from "react";
import { submitSurvey } from "../api/survey.js";

const styles = {
  container: {
    background: "#fff",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
    width: "100%",
    maxWidth: "600px",
  },
  title: { fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" },
  subtitle: { color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem" },
  productCard: {
    border: "1.5px solid #e5e7eb",
    borderRadius: "10px",
    padding: "1.25rem",
    marginBottom: "1rem",
  },
  productLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#6b7280",
    marginBottom: "0.3rem",
  },
  productName: {
    fontWeight: 700,
    fontSize: "1.1rem",
    color: "#111827",
    marginBottom: "0.25rem",
  },
  productPrice: {
    fontSize: "0.875rem",
    color: "#6b7280",
    marginBottom: "1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #f3f4f6",
  },
  noQuestions: {
    background: "#f9fafb",
    borderRadius: "6px",
    padding: "0.6rem 0.9rem",
    color: "#9ca3af",
    fontSize: "0.875rem",
    fontStyle: "italic",
  },
  questionBlock: { marginBottom: "1rem" },
  questionText: { fontWeight: 600, fontSize: "0.9rem", color: "#374151", marginBottom: "0.5rem" },
  submitBtn: {
    marginTop: "1.5rem",
    width: "100%",
    padding: "0.75rem",
    borderRadius: "8px",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#dc2626", fontSize: "0.875rem", marginTop: "0.5rem" },
  // rating
  stars: { display: "flex", gap: "0.5rem" },
  star: {
    width: "40px",
    height: "40px",
    border: "2px solid #d1d5db",
    borderRadius: "50%",
    background: "#fff",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  starActive: {
    width: "40px",
    height: "40px",
    border: "2px solid #f59e0b",
    borderRadius: "50%",
    background: "#fef3c7",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#b45309",
  },
  // yesno
  yesnoRow: { display: "flex", gap: "0.75rem" },
  yesnoBtn: {
    flex: 1,
    padding: "0.65rem",
    border: "2px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  yesnoBtnActive: {
    flex: 1,
    padding: "0.65rem",
    border: "2px solid #2563eb",
    borderRadius: "8px",
    background: "#eff6ff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.95rem",
    color: "#1d4ed8",
  },
  // text
  textarea: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "0.9rem",
    resize: "vertical",
    minHeight: "72px",
    boxSizing: "border-box",
  },
  // choice
  radioLabel: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer", fontSize: "0.9rem" },
};

function RatingInput({ value, onChange }) {
  return (
    <div style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          style={value >= n ? styles.starActive : styles.star}
          onClick={() => onChange(String(n))}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function YesNoInput({ value, onChange }) {
  return (
    <div style={styles.yesnoRow}>
      {["Tak", "Nie"].map((opt) => (
        <button
          key={opt}
          type="button"
          style={value === opt ? styles.yesnoBtnActive : styles.yesnoBtn}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ChoiceInput({ options, value, onChange }) {
  return (
    <div>
      {(options || []).map((opt) => (
        <label key={opt} style={styles.radioLabel}>
          <input
            type="radio"
            name={`choice-${opt}`}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function QuestionInput({ question, value, onChange }) {
  switch (question.type) {
    case "rating":
      return <RatingInput value={Number(value)} onChange={onChange} />;
    case "yesno":
      return <YesNoInput value={value} onChange={onChange} />;
    case "text":
      return (
        <textarea
          style={styles.textarea}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Wpisz swoją odpowiedź..."
        />
      );
    case "choice":
      return <ChoiceInput options={question.options} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

export default function SurveyView({ bill, onDone }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function setAnswer(productId, questionId, value) {
    setAnswers((prev) => ({ ...prev, [`${productId}_${questionId}`]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const answerList = [];
      for (const product of bill.products) {
        for (const q of product.questions || []) {
          const val = answers[`${product.id}_${q.id}`];
          if (val !== undefined && val !== "") {
            answerList.push({ product_id: product.id, product_name: product.name, question_id: q.id, value: String(val) });
          }
        }
      }
      await submitSurvey({ bill_number: bill.bill_number, answers: answerList });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Ankieta — paragon #{bill.bill_number}</h1>
      <p style={styles.subtitle}>
        Oceń produkty ze swojego zamówienia ({bill.products.length}{" "}
        {bill.products.length === 1 ? "produkt" : "produkty/ów"}).
      </p>

      {bill.products.map((product) => (
        <div key={product.id} style={styles.productCard}>
          <div style={styles.productLabel}>Oceniasz</div>
          <div style={styles.productName}>{product.name}</div>
          <div style={styles.productPrice}>{product.price.toFixed(2)} zł</div>

          {(!product.questions || product.questions.length === 0) ? (
            <div style={styles.noQuestions}>Brak pytań dla tego produktu.</div>
          ) : (
            product.questions.map((q) => (
              <div key={q.id} style={styles.questionBlock}>
                <div style={styles.questionText}>{q.text}</div>
                <QuestionInput
                  question={q}
                  value={answers[`${product.id}_${q.id}`]}
                  onChange={(val) => setAnswer(product.id, q.id, val)}
                />
              </div>
            ))
          )}
        </div>
      ))}

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "Wysyłanie..." : "Wyślij ankietę"}
      </button>
    </div>
  );
}
