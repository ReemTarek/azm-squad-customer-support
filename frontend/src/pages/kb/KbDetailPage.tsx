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
  if (error) return <p role="alert" className="form-error">Article not found.</p>;
  if (!article) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{article.title}</h1>
        {canAuthor && (
          <button onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}>
            {article.published ? "Unpublish" : "Publish"}
          </button>
        )}
      </div>
      <p className="form-hint">{article.category} {!article.published && "· Draft"}</p>
      <p className="kb-body">{article.body}</p>
    </div>
  );
}
