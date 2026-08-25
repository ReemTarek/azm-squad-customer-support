import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getArticle, updateArticle } from "../../lib/kbApi";
import { useAuth } from "../../auth/AuthContext";

export function KbDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canAuthor = user?.role === "Admin" || user?.role === "Agent";
  const queryClient = useQueryClient();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["kb", id],
    queryFn: () => getArticle(id!),
    enabled: Boolean(id),
  });

  const togglePublish = useMutation({
    mutationFn: () => updateArticle(id!, { published: !article!.published }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", id] }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert" className="alert alert-danger">Article not found.</p>;
  if (!article) return null;

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>{article.title}</h1>
        {canAuthor && (
          <button className="btn btn-primary" onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}>
            {article.published ? "Unpublish" : "Publish"}
          </button>
        )}
      </div>
      <p className="form-text text-muted">{article.category} {!article.published && "· Draft"}</p>
      <div className="card card-body">
        <p className="kb-body mb-0 lh-lg">{article.body}</p>
      </div>
    </div>
  );
}
