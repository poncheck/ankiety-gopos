import { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ReceiptForm from "./components/ReceiptForm.jsx";
import SurveyView from "./components/SurveyView.jsx";
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

function SurveyApp() {
  const [bill, setBill] = useState(null);
  const [submitted, setSubmitted] = useState(false);
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
      <div style={{ textAlign: "center" }}>
        <h1>Dziękujemy!</h1>
        <p>Twoja opinia została zapisana.</p>
      </div>
    );
  }

  if (bill) {
    return <SurveyView bill={bill} onDone={() => setSubmitted(true)} />;
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
