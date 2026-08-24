import { useAuth } from "../auth/AuthContext";

export function DashboardShellPage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <h1>Welcome, {user?.name}</h1>
      <p>Role-specific dashboard views land here in later tasks.</p>
    </div>
  );
}
