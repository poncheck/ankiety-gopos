const BASE = "/api/survey";

export async function fetchBill(billNumber) {
  const res = await fetch(`${BASE}/bill/${encodeURIComponent(billNumber)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Nie znaleziono paragonu");
  }
  return res.json();
}

export async function submitSurvey(data) {
  const res = await fetch(`${BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Błąd zapisu ankiety");
  }
  return res.json();
}
