import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSlaPolicies, updateSlaPolicy } from "../lib/slaConfigApi";
import { extractApiErrorMessage } from "../lib/apiClient";

const ORDER = ["Urgent", "High", "Medium", "Low"];

export function AdminSlaSettingsPage() {
  const queryClient = useQueryClient();
  const { data: policies, isLoading } = useQuery({ queryKey: ["sla-policies"], queryFn: listSlaPolicies });
  const [drafts, setDrafts] = useState<Record<string, { responseMinutes: number; resolutionMinutes: number }>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedPriority, setSavedPriority] = useState<string | null>(null);

  useEffect(() => {
    if (policies) {
      const next: typeof drafts = {};
      for (const p of policies) next[p.priority] = { responseMinutes: p.responseMinutes, resolutionMinutes: p.resolutionMinutes };
      setDrafts(next);
    }
  }, [policies]);

  const mutation = useMutation({
    mutationFn: (priority: string) => updateSlaPolicy(priority, drafts[priority]),
    onSuccess: (_data, priority) => {
      setSavedPriority(priority);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  if (isLoading) return <p>Loading…</p>;

  const sorted = [...(policies ?? [])].sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));

  return (
    <div className="page">
      <h1>SLA Settings</h1>
      <p className="form-text text-muted">
        Changes apply to new tickets and priority changes going forward — existing tickets keep their original due dates.
      </p>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3">
        {sorted.map((p) => (
          <div key={p.priority} className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 card-title">{p.priority}</h2>
                <div className="mb-3">
                  <label className="form-label" htmlFor={`sla-response-${p.priority}`}>Response (minutes)</label>
                  <input
                    id={`sla-response-${p.priority}`}
                    type="number"
                    className="form-control"
                    min={1}
                    value={drafts[p.priority]?.responseMinutes ?? ""}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [p.priority]: { ...drafts[p.priority], responseMinutes: Number(e.target.value) } })
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor={`sla-resolution-${p.priority}`}>Resolution (minutes)</label>
                  <input
                    id={`sla-resolution-${p.priority}`}
                    type="number"
                    className="form-control"
                    min={1}
                    value={drafts[p.priority]?.resolutionMinutes ?? ""}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [p.priority]: { ...drafts[p.priority], resolutionMinutes: Number(e.target.value) } })
                    }
                  />
                </div>
                <button className="btn btn-primary" onClick={() => mutation.mutate(p.priority)} disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save"}
                </button>
                {savedPriority === p.priority && mutation.isSuccess && <p className="alert alert-success">Saved.</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
