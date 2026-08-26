import { apiClient } from "./apiClient";

export interface BrandingConfig {
  appName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, "");

export async function getBranding() {
  const { data } = await apiClient.get<{ config: BrandingConfig }>("/admin/branding");
  return data.config;
}

// logoUrl from the backend is a relative path (e.g. "/api/admin/branding/logo")
// — an <img> tag needs an absolute URL, and it must bypass apiClient
// entirely (no Authorization header attached, matching the route's
// deliberately public/unauthenticated design).
export function absoluteLogoUrl(logoUrl: string | null): string | null {
  return logoUrl ? `${apiOrigin}${logoUrl}` : null;
}

export async function updateBranding(input: {
  appName?: string;
  primaryColor?: string;
  logo?: File;
  removeLogo?: boolean;
}) {
  const form = new FormData();
  if (input.appName !== undefined) form.append("appName", input.appName);
  if (input.primaryColor !== undefined) form.append("primaryColor", input.primaryColor);
  if (input.logo) form.append("logo", input.logo);
  if (input.removeLogo) form.append("removeLogo", "true");

  const { data } = await apiClient.patch<{ config: BrandingConfig }>("/admin/branding", form);
  return data.config;
}
