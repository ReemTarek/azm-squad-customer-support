import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBranding, absoluteLogoUrl } from "../lib/brandingApi";
import { applyBrandColor } from "../lib/brandColor";

const DEFAULT_APP_NAME = "AZM Support CRM";

interface BrandingValue {
  appName: string | null;
  logoUrl: string | null;
}

const BrandingContext = createContext<BrandingValue>({ appName: null, logoUrl: null });

export function BrandingProvider({ children }: { children: ReactNode }) {
  // Deliberately NOT gated on auth state (no `enabled: Boolean(user)`)
  // — branding must apply on the login page and set the browser tab
  // title before any authentication has happened.
  const { data } = useQuery({ queryKey: ["branding"], queryFn: getBranding });

  useEffect(() => {
    document.title = data?.appName ?? DEFAULT_APP_NAME;
  }, [data?.appName]);

  useEffect(() => {
    applyBrandColor(data?.primaryColor ?? null);
  }, [data?.primaryColor]);

  const value: BrandingValue = {
    appName: data?.appName ?? null,
    logoUrl: absoluteLogoUrl(data?.logoUrl ?? null),
  };

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
