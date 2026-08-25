import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaffUser,
  listAllUsers,
  updateStaffUser,
} from "../../lib/usersApi";
import type { StaffUser } from "../../lib/usersApi";
import { listDepartments, listBranches } from "../../lib/orgApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";

const STAFF_ROLES = ["Admin", "Manager", "Agent"] as const;

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["all-users"], queryFn: listAllUsers });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("Agent");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffUser({
        email,
        password,
        name,
        role,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setName("");
      setRole("Agent");
      setDepartmentId("");
      setBranchId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; changes: Parameters<typeof updateStaffUser>[1] }) =>
      updateStaffUser(input.id, input.changes),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  function handleFieldChange(u: StaffUser, field: "role" | "departmentId" | "branchId", value: string) {
    updateMutation.mutate({
      id: u.id,
      changes: {
        [field]: field === "role" ? value : value || null,
      } as Parameters<typeof updateStaffUser>[1],
    });
  }

  function handleToggleActive(u: StaffUser) {
    updateMutation.mutate({ id: u.id, changes: { isActive: !u.isActive } });
  }

  const staff = (usersQuery.data ?? []).filter((u) => u.role !== "Customer");

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>Users</h1>
      </div>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h5 card-title">Create staff account</h2>
          <form onSubmit={handleCreate} className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-name">Name</label>
              <input id="new-user-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-email">Email</label>
              <input id="new-user-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="new-user-password">Password</label>
              <input id="new-user-password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="new-user-role">Role</label>
              <select id="new-user-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-department">Department (optional)</label>
              <select id="new-user-department" className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">None</option>
                {departmentsQuery.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-branch">Branch (optional)</label>
              <select id="new-user-branch" className="form-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">None</option>
                {branchesQuery.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </form>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Branch</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.role}
                    onChange={(e) => handleFieldChange(u, "role", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.departmentId ?? ""}
                    onChange={(e) => handleFieldChange(u, "departmentId", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    <option value="">None</option>
                    {departmentsQuery.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.branchId ?? ""}
                    onChange={(e) => handleFieldChange(u, "branchId", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    <option value="">None</option>
                    {branchesQuery.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? "bg-success" : "bg-secondary"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  {u.id === currentUser?.id ? (
                    <span className="text-muted small">(you)</span>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-sm ${u.isActive ? "btn-outline-danger" : "btn-outline-success"}`}
                      onClick={() => handleToggleActive(u)}
                      disabled={updateMutation.isPending}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
