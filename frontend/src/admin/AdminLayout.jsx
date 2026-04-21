import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";

const s = {
  wrap: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f3f4f6" },
  nav: {
    background: "#1e293b",
    color: "#fff",
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "2rem",
    height: "56px",
  },
  brand: { fontWeight: 700, fontSize: "1rem", color: "#fff", textDecoration: "none" },
  navLink: { color: "#cbd5e1", textDecoration: "none", fontSize: "0.875rem" },
  logoutBtn: {
    marginLeft: "auto",
    background: "transparent",
    border: "1px solid #475569",
    color: "#cbd5e1",
    borderRadius: "6px",
    padding: "0.3rem 0.75rem",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  content: { flex: 1, padding: "2rem", maxWidth: "1000px", width: "100%", margin: "0 auto" },
};

export default function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      navigate("/admin/login");
    }
  }, [navigate]);

  function logout() {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  }

  return (
    <div style={s.wrap}>
      <nav style={s.nav}>
        <Link to="/admin" style={s.brand}>Ankiety — Admin</Link>
        <Link to="/admin/categories" style={s.navLink}>Kategorie</Link>
        <Link to="/admin/products" style={s.navLink}>Produkty</Link>
        <Link to="/admin/responses" style={s.navLink}>Odpowiedzi</Link>
        <Link to="/admin/import" style={s.navLink}>Import pytań</Link>
        <Link to="/admin/settings" style={s.navLink}>Ustawienia</Link>
        <Link to="/admin/users" style={s.navLink}>Użytkownicy</Link>
        <Link to="/" style={s.navLink}>Ankieta</Link>
        <button style={s.logoutBtn} onClick={logout}>Wyloguj</button>
      </nav>
      <div style={s.content}>
        <Outlet />
      </div>
    </div>
  );
}
