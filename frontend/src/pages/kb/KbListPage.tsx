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
      <div className="page-header">
        <h1>Knowledge Base</h1>
        {canAuthor && <Link to="/kb/new" className="button-link">New Article</Link>}
      </div>
      <input
        type="search"
        placeholder="Search articles…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="form-error">Failed to load articles.</p>}
      <ul className="kb-list">
        {articles?.map((a) => (
          <li key={a.id}>
            <Link to={`/kb/${a.id}`}>{a.title}</Link>
            <span className="kb-category">{a.category}</span>
            {!a.published && canAuthor && <span className="kb-draft-tag">Draft</span>}
          </li>
        ))}
        {articles?.length === 0 && <li>No articles found.</li>}
      </ul>
    </div>
  );
}
