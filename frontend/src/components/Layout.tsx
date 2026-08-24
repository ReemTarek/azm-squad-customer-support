import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">AZM Support CRM</Link>
        <nav>
          {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
            <Link to="/customers">Customers</Link>
          )}
          <Link to="/tickets">Tickets</Link>
        </nav>
        <div className="app-header-user">
          <span>{user.name} ({user.role})</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
