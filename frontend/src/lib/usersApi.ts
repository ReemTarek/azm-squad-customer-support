import { apiClient } from "./apiClient";
import type { Role } from "./authApi";

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  locale: "en" | "ar";
}

export async function listUsersByRole(role: Role) {
  const { data } = await apiClient.get<{ users: StaffUser[] }>("/users", { params: { role } });
  return data.users;
}
