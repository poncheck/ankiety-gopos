import { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ReceiptForm from "./components/ReceiptForm.jsx";
import SurveyView from "./components/SurveyView.jsx";
import BarcodeDisplay from "./components/BarcodeDisplay.jsx";
import { fetchBill } from "./api/survey.js";
import LoginPage from "./admin/LoginPage.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import CategoriesPage from "./admin/CategoriesPage.jsx";
import QuestionsPage from "./admin/QuestionsPage.jsx";
import ResponsesPage from "./admin/ResponsesPage.jsx";
import ResponseDetailPage from "./admin/ResponseDetailPage.jsx";
import ProductsPage from "./admin/ProductsPage.jsx";
import SettingsPage from "./admin/SettingsPage.jsx";
import ImportPage from "./admin/ImportPage.jsx";
import UsersPage from "./admin/UsersPage.jsx";

function SurveyApp() {
  const [bill, setBill] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [surveyCode, setSurveyCode] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  async function handleBillSubmit(billNumber) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBill(billNumber);
      setBill(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center", maxWidth: "480px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.6rem", color: "#111827", marginBottom: "0.5rem" }}>Dziękujemy!</h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>Twoja opinia została zapisana.</p>
        {surveyCode && (
          <div style={{
            background: "#f0fdf4",
            border: "2px dashed #16a34a",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1rem",
          }}>
            <p style={{ color: "#15803d", fontWeight: 600, marginBottom: "1rem" }}>
              Twój kod rabatowy:
            </p>
            <BarcodeDisplay value={surveyCode} />
            <p style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "1rem" }}>
              Pokaż kod kasjerowi lub zeskanuj przy kasie. Kod został też wysłany na Twój adres e-mail.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (bill?.already_submitted) {
    return (
      <div style={{ textAlign: "center", maxWidth: "480px", margin: "0 auto" }}>
        <div style={{
          background: "#fefce8",
          border: "2px solid #fde047",
          borderRadius: "12px",
          padding: "2rem",
          marginBottom: "1rem",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.2rem", color: "#854d0e", marginBottom: "0.5rem" }}>
            Ankieta już wypełniona
          </h2>
          <p style={{ color: "#713f12", fontSize: "0.9rem" }}>
            Paragon <strong>#{bill.bill_number}</strong> został już wykorzystany do ankiety.
            Każdy paragon można ocenić tylko raz.
          </p>
        </div>
        <button
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.5rem",
            borderRadius: "8px",
            border: "none",
            background: "#e5e7eb",
            color: "#374151",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => setBill(null)}
        >
          Wróć
        </button>
      </div>
    );
  }

  if (bill) {
    return <SurveyView bill={bill} onDone={(code) => { setSurveyCode(code); setSubmitted(true); }} />;
  }

  return (
    <ReceiptForm onSubmit={handleBillSubmit} loading={loading} error={error} settings={settings} />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SurveyApp />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<CategoriesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:id/questions" element={<QuestionsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="responses" element={<ResponsesPage />} />
          <Route path="responses/:id" element={<ResponseDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
