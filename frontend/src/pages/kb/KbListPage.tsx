import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listArticles } from "../../lib/kbApi";
import { useAuth } from "../../auth/AuthContext";

export function KbListPage() {
  const { user } = useAuth();
  const canAuthor = user?.role === "Admin" || user?.role === "Agent";
  const [search, setSearch] = useState("");
  const { data: articles, isLoading, error } = useQuery({
    queryKey: ["kb", search],
    queryFn: () => listArticles(search || undefined),
  });

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>Knowledge Base</h1>
        {canAuthor && <Link to="/kb/new" className="btn btn-primary">New Article</Link>}
      </div>
      <input
        type="search"
        placeholder="Search articles…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="form-control mb-3"
        style={{ maxWidth: 280 }}
      />
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="alert alert-danger">Failed to load articles.</p>}
      <ul className="list-group mb-3">
        {articles?.map((a) => (
          <li key={a.id} className="list-group-item d-flex align-items-center gap-2">
            <Link to={`/kb/${a.id}`}>{a.title}</Link>
            <span className="text-muted small">{a.category}</span>
            {!a.published && canAuthor && <span className="badge bg-warning text-dark">Draft</span>}
          </li>
        ))}
        {articles?.length === 0 && <li className="list-group-item">No articles found.</li>}
      </ul>
    </div>
  );
}
