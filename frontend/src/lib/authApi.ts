import { apiClient } from "./apiClient";

export type Role = "Admin" | "Manager" | "Agent" | "Customer";

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  locale: "en" | "ar";
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export async function registerRequest(input: { email: string; password: string; name: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", input);
  return data;
}

export async function loginRequest(input: { email: string; password: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<{ user: PublicUser }>("/users/me");
  return data.user;
}
