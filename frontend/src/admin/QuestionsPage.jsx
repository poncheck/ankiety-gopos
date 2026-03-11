import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from "./api/admin.js";

const TYPES = ["rating", "yesno", "text", "choice"];
const TYPE_LABELS = { rating: "Ocena 1-5", yesno: "Tak / Nie", text: "Tekst", choice: "Wybór" };

const s = {
  header: { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" },
  title: { fontSize: "1.5rem", fontWeight: 700 },
  backBtn: { background: "none", border: "1.5px solid #d1d5db", borderRadius: "8px", padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.875rem" },
  card: { background: "#fff", borderRadius: "10px", padding: "1.25rem", marginBottom: "0.75rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", alignItems: "flex-start", gap: "1rem" },
  questionText: { fontWeight: 600, marginBottom: "0.25rem" },
  questionMeta: { fontSize: "0.8rem", color: "#6b7280" },
  actions: { marginLeft: "auto", display: "flex", gap: "0.5rem" },
  editBtn: { background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" },
  delBtn: { background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.8rem" },
  form: { background: "#fff", borderRadius: "10px", padding: "1.5rem", marginTop: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  formTitle: { fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" },
  label: { display: "block", fontWeight: 500, fontSize: "0.875rem", marginBottom: "0.25rem" },
  input: { width: "100%", padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.95rem", marginBottom: "0.75rem", boxSizing: "border-box" },
  select: { width: "100%", padding: "0.6rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: "8px", fontSize: "0.95rem", marginBottom: "0.75rem", background: "#fff" },
  saveBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "0.65rem 1.5rem", fontWeight: 600, cursor: "pointer", fontSize: "0.95rem" },
  cancelBtn: { background: "none", border: "1.5px solid #d1d5db", borderRadius: "8px", padding: "0.65rem 1.2rem", cursor: "pointer", fontSize: "0.95rem", marginRight: "0.5rem" },
  addBtn: { background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", padding: "0.6rem 1.2rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" },
  err: { color: "#dc2626", fontSize: "0.875rem", marginTop: "0.5rem" },
};

const emptyForm = { text: "", type: "rating", options: "", position: 0, active: true };

export default function QuestionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const data = await getQuestions(id);
      setQuestions(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  function startAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function startEdit(q) {
    setEditing(q.id);
    setForm({
      text: q.text,
      type: q.type,
      options: (q.options || []).join("\n"),
      position: q.position,
      active: q.active,
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    const body = {
      text: form.text,
      type: form.type,
      options: form.type === "choice" ? form.options.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      position: Number(form.position),
      active: form.active,
    };
    try {
      if (editing) {
        await updateQuestion(editing, body);
      } else {
        await createQuestion(id, body);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(qid) {
    if (!confirm("Usunąć pytanie?")) return;
    try {
      await deleteQuestion(qid);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function movePosition(q, dir) {
    try {
      await updateQuestion(q.id, { position: q.position + dir });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/admin/categories")}>← Powrót</button>
        <h1 style={s.title}>Pytania kategorii</h1>
        <button style={s.addBtn} onClick={startAdd}>+ Dodaj pytanie</button>
      </div>

      {error && <p style={s.err}>{error}</p>}

      {questions.length === 0 && !showForm && (
        <p style={{ color: "#6b7280" }}>Brak pytań. Kliknij &quot;+ Dodaj pytanie&quot;.</p>
      )}

      {questions.map((q) => (
        <div key={q.id} style={{ ...s.card, opacity: q.active ? 1 : 0.5 }}>
          <div style={{ flex: 1 }}>
            <div style={s.questionText}>{q.text}</div>
            <div style={s.questionMeta}>
              {TYPE_LABELS[q.type]} · pozycja {q.position}
              {!q.active && " · nieaktywne"}
              {q.options && q.options.length > 0 && ` · opcje: ${q.options.join(", ")}`}
            </div>
          </div>
          <div style={s.actions}>
            <button style={s.editBtn} onClick={() => movePosition(q, -1)}>↑</button>
            <button style={s.editBtn} onClick={() => movePosition(q, 1)}>↓</button>
            <button style={s.editBtn} onClick={() => startEdit(q)}>Edytuj</button>
            <button style={s.delBtn} onClick={() => handleDelete(q.id)}>Usuń</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={s.form}>
          <div style={s.formTitle}>{editing ? "Edytuj pytanie" : "Nowe pytanie"}</div>

          <label style={s.label}>Treść pytania</label>
          <input
            style={s.input}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Jak oceniasz produkt?"
          />

          <label style={s.label}>Typ pytania</label>
          <select style={s.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>

          {form.type === "choice" && (
            <>
              <label style={s.label}>Opcje (każda w nowej linii)</label>
              <textarea
                style={{ ...s.input, height: "80px", resize: "vertical" }}
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
                placeholder={"Bardzo dobrze\nDobrze\nŚrednio"}
              />
            </>
          )}

          <label style={s.label}>Pozycja</label>
          <input
            style={{ ...s.input, width: "100px" }}
            type="number"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />

          <div style={{ marginBottom: "0.75rem" }}>
            <label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                style={{ marginRight: "0.4rem" }}
              />
              Aktywne
            </label>
          </div>

          {error && <p style={s.err}>{error}</p>}

          <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Anuluj</button>
          <button style={s.saveBtn} onClick={handleSave}>Zapisz</button>
        </div>
      )}
    </div>
  );
}
