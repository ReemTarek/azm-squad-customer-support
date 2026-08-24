import { apiClient } from "./apiClient";

export interface OrgUnit {
  id: string;
  name: string;
  createdAt: string;
}

export async function listDepartments() {
  const { data } = await apiClient.get<{ departments: OrgUnit[] }>("/admin/departments");
  return data.departments;
}

export async function createDepartment(name: string) {
  const { data } = await apiClient.post<{ department: OrgUnit }>("/admin/departments", { name });
  return data.department;
}

export async function listBranches() {
  const { data } = await apiClient.get<{ branches: OrgUnit[] }>("/admin/branches");
  return data.branches;
}

export async function createBranch(name: string) {
  const { data } = await apiClient.post<{ branch: OrgUnit }>("/admin/branches", { name });
  return data.branch;
}
