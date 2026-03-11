import { useState, useEffect, useRef } from "react";
import {
  getAdminSettings,
  updateInstructions,
  uploadLogo,
  deleteLogo,
  uploadReceiptImage,
  deleteReceiptImage,
} from "./api/admin";

const styles = {
  page: { padding: "32px", maxWidth: 680, margin: "0 auto" },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1e293b" },
  subheading: { fontSize: 13, color: "#64748b", marginBottom: 32 },
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "24px",
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#1e293b" },
  preview: {
    maxWidth: "100%",
    maxHeight: 160,
    objectFit: "contain",
    display: "block",
    marginBottom: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#f8fafc",
    padding: 8,
  },
  noImage: {
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 8,
    padding: "32px 0",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 16,
  },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btnPrimary: {
    padding: "8px 16px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  btnDanger: {
    padding: "8px 16px",
    background: "#fff",
    color: "#ef4444",
    border: "1px solid #ef4444",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  msg: { fontSize: 13, marginTop: 10 },
  msgOk: { color: "#16a34a" },
  msgErr: { color: "#dc2626" },
  textarea: {
    width: "100%",
    minHeight: 100,
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.5,
    boxSizing: "border-box",
    outline: "none",
  },
  saveBtn: {
    marginTop: 12,
    padding: "8px 20px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
};

function ImageField({ label, currentUrl, onUpload, onDelete, accept = "image/*" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { text, ok }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusy(true);
    setMsg(null);
    try {
      await onUpload(file);
      setMsg({ text: "Zapisano ✓", ok: true });
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!currentUrl) return;
    setBusy(true);
    setMsg(null);
    try {
      await onDelete();
      setMsg({ text: "Usunięto ✓", ok: true });
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{label}</div>
      {currentUrl ? (
        <img src={currentUrl} alt={label} style={styles.preview} />
      ) : (
        <div style={styles.noImage}>Brak obrazu</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <div style={styles.btnRow}>
        <button
          style={{ ...styles.btnPrimary, ...(busy ? styles.btnDisabled : {}) }}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Przesyłanie…" : currentUrl ? "Zmień" : "Wybierz plik"}
        </button>
        {currentUrl && (
          <button
            style={{ ...styles.btnDanger, ...(busy ? styles.btnDisabled : {}) }}
            disabled={busy}
            onClick={handleDelete}
          >
            Usuń
          </button>
        )}
      </div>
      {msg && (
        <p style={{ ...styles.msg, ...(msg.ok ? styles.msgOk : styles.msgErr) }}>{msg.text}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [instructions, setInstructions] = useState("");
  const [instrMsg, setInstrMsg] = useState(null);
  const [instrBusy, setInstrBusy] = useState(false);

  async function load() {
    try {
      const data = await getAdminSettings();
      setSettings(data);
      setInstructions(data.receipt_instructions || "");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveInstructions() {
    setInstrBusy(true);
    setInstrMsg(null);
    try {
      await updateInstructions(instructions || null);
      setInstrMsg({ text: "Zapisano ✓", ok: true });
    } catch (err) {
      setInstrMsg({ text: err.message, ok: false });
    } finally {
      setInstrBusy(false);
    }
  }

  const logoUrl = settings?.logo_filename
    ? `/static/uploads/${settings.logo_filename}`
    : null;
  const receiptUrl = settings?.receipt_image_filename
    ? `/static/uploads/${settings.receipt_image_filename}`
    : null;

  async function doUploadLogo(file) {
    await uploadLogo(file);
    await load();
  }

  async function doDeleteLogo() {
    await deleteLogo();
    await load();
  }

  async function doUploadReceipt(file) {
    await uploadReceiptImage(file);
    await load();
  }

  async function doDeleteReceipt() {
    await deleteReceiptImage();
    await load();
  }

  if (settings === null) {
    return <div style={styles.page}>Ładowanie…</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.heading}>Ustawienia wyglądu</div>
      <div style={styles.subheading}>
        Skonfiguruj logo, przykładowy paragon i instrukcję widoczne na stronie ankiety.
      </div>

      <ImageField
        label="Logo"
        currentUrl={logoUrl}
        onUpload={doUploadLogo}
        onDelete={doDeleteLogo}
      />

      <ImageField
        label="Przykładowy paragon (wskazówka)"
        currentUrl={receiptUrl}
        onUpload={doUploadReceipt}
        onDelete={doDeleteReceipt}
      />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Instrukcja — jak znaleźć numer paragonu</div>
        <textarea
          style={styles.textarea}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Np. Numer paragonu znajduje się w prawym górnym rogu wydruku..."
        />
        <button
          style={{ ...styles.saveBtn, ...(instrBusy ? styles.btnDisabled : {}) }}
          disabled={instrBusy}
          onClick={handleSaveInstructions}
        >
          {instrBusy ? "Zapisywanie…" : "Zapisz"}
        </button>
        {instrMsg && (
          <p style={{ ...styles.msg, ...(instrMsg.ok ? styles.msgOk : styles.msgErr) }}>
            {instrMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}
