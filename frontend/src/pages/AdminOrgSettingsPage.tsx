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
      <p className="form-text text-muted">
        Assign a Manager to a department/branch via user management (API) to scope their ticket visibility.
        Managers with no department/branch set continue to see everything.
      </p>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <div className="row row-cols-1 row-cols-md-2 g-3">
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5 card-title">Departments</h2>
              <ul className="list-group list-group-flush mb-3">
                {departmentsQuery.data?.map((d) => <li key={d.id} className="list-group-item">{d.name}</li>)}
                {departmentsQuery.data?.length === 0 && <li className="list-group-item">None yet.</li>}
              </ul>
              <form onSubmit={handleAddDept} className="d-flex gap-2">
                <label className="visually-hidden" htmlFor="new-department-name">New department name</label>
                <input id="new-department-name" type="text" className="form-control" placeholder="New department name…" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
                <button type="submit" className="btn btn-primary" disabled={createDeptMutation.isPending}>Add</button>
              </form>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5 card-title">Branches</h2>
              <ul className="list-group list-group-flush mb-3">
                {branchesQuery.data?.map((b) => <li key={b.id} className="list-group-item">{b.name}</li>)}
                {branchesQuery.data?.length === 0 && <li className="list-group-item">None yet.</li>}
              </ul>
              <form onSubmit={handleAddBranch} className="d-flex gap-2">
                <label className="visually-hidden" htmlFor="new-branch-name">New branch name</label>
                <input id="new-branch-name" type="text" className="form-control" placeholder="New branch name…" value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
                <button type="submit" className="btn btn-primary" disabled={createBranchMutation.isPending}>Add</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
