import { useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  Link,
} from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Webhooks } from "./pages/Webhooks";
import { EditWebhook } from "./pages/EditWebhook";

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSigningOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);

    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" to="/webhooks">
          ◈ <span>Test work</span>
        </Link>
        <span className="eyebrow sidebar-label">WORKSPACE</span>
        <Link className="nav-item" to="/webhooks">
          ↗ <span>Webhooks</span>
        </Link>
        <div className="sidebar-bottom">
          <span className="avatar">TU</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span>Integration workspace</span>
          <button
            className="secondary"
            disabled={isSigningOut}
            onClick={handleLogout}
          >
            {isSigningOut ? "Signing out…" : "Log out"}
          </button>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer>Test work</footer>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/webhooks/:id" element={<EditWebhook />} />
      </Route>
      <Route path="/" element={<Navigate to="/webhooks" replace />} />
      <Route
        path="*"
        element={
          <main className="feedback">
            <h1>Page not found</h1>
            <Link to="/webhooks">Go to webhooks</Link>
          </main>
        }
      />
    </Routes>
  );
}
