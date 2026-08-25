import { apiClient } from "./apiClient";
import type { Role } from "./authApi";

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  locale: "en" | "ar";
  departmentId: string | null;
  branchId: string | null;
  isActive: boolean;
}

export async function listUsersByRole(role: Role) {
  const { data } = await apiClient.get<{ users: StaffUser[] }>("/users", { params: { role } });
  return data.users;
}

export async function listAllUsers() {
  const { data } = await apiClient.get<{ users: StaffUser[] }>("/users");
  return data.users;
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  name: string;
  role: "Admin" | "Manager" | "Agent";
  departmentId?: string;
  branchId?: string;
}) {
  const { data } = await apiClient.post<{ user: StaffUser }>("/users", input);
  return data.user;
}

export async function updateStaffUser(
  id: string,
  input: Partial<{
    role: "Admin" | "Manager" | "Agent" | "Customer";
    departmentId: string | null;
    branchId: string | null;
    isActive: boolean;
  }>
) {
  const { data } = await apiClient.patch<{ user: StaffUser }>(`/users/${id}`, input);
  return data.user;
}
