import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomer, updateCustomer } from "../../lib/customersApi";
import { extractApiErrorMessage } from "../../lib/apiClient";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: Boolean(id),
  });

  const [form, setForm] = useState({ name: "", phone: "", company: "" });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setForm({ name: customer.name, phone: customer.phone ?? "", company: customer.company ?? "" });
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: () => updateCustomer(id!, { name: form.name, phone: form.phone, company: form.company }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
    onError: (err) => setSaveError(extractApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    mutation.mutate();
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert" className="form-error">Failed to load customer.</p>;
  if (!customer) return null;

  return (
    <div className="page">
      <h1>{customer.name}</h1>
      <p className="form-hint">{customer.email}</p>
      <form onSubmit={handleSubmit} className="entity-form">
        {saveError && <p role="alert" className="form-error">{saveError}</p>}
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Company
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </label>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </button>
        {mutation.isSuccess && <p className="form-success">Saved.</p>}
      </form>
    </div>
  );
}
