import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBranch, createDepartment, listBranches, listDepartments } from "../lib/orgApi";
import { extractApiErrorMessage } from "../lib/apiClient";

export function AdminOrgSettingsPage() {
  const queryClient = useQueryClient();
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const [deptName, setDeptName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createDeptMutation = useMutation({
    mutationFn: () => createDepartment(deptName),
    onSuccess: () => {
      setDeptName("");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const createBranchMutation = useMutation({
    mutationFn: () => createBranch(branchName),
    onSuccess: () => {
      setBranchName("");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleAddDept(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createDeptMutation.mutate();
  }

  function handleAddBranch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createBranchMutation.mutate();
  }

  return (
    <div className="page">
      <h1>Departments &amp; Branches</h1>
      <p className="form-hint">
        Assign a Manager to a department/branch via user management (API) to scope their ticket visibility.
        Managers with no department/branch set continue to see everything.
      </p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="report-grid">
        <section className="report-card">
          <h2>Departments</h2>
          <ul className="history-list">
            {departmentsQuery.data?.map((d) => <li key={d.id}>{d.name}</li>)}
            {departmentsQuery.data?.length === 0 && <li>None yet.</li>}
          </ul>
          <form onSubmit={handleAddDept} className="entity-form entity-form--inline">
            <input type="text" placeholder="New department name…" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
            <button type="submit" disabled={createDeptMutation.isPending}>Add</button>
          </form>
        </section>
        <section className="report-card">
          <h2>Branches</h2>
          <ul className="history-list">
            {branchesQuery.data?.map((b) => <li key={b.id}>{b.name}</li>)}
            {branchesQuery.data?.length === 0 && <li>None yet.</li>}
          </ul>
          <form onSubmit={handleAddBranch} className="entity-form entity-form--inline">
            <input type="text" placeholder="New branch name…" value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
            <button type="submit" disabled={createBranchMutation.isPending}>Add</button>
          </form>
        </section>
      </div>
    </div>
  );
}
