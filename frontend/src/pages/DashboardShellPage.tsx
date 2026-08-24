import { useAuth } from "../auth/AuthContext";

export function DashboardShellPage() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <header>
        <h1>AZM Support CRM</h1>
        <div>
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main>
        <p>Authenticated dashboard shell — role-specific views land here in later tasks.</p>
      </main>
    </div>
  );
}
