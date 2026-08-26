import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranding, updateBranding, absoluteLogoUrl } from "../../lib/brandingApi";
import { extractApiErrorMessage } from "../../lib/apiClient";

export function BrandingSettingsPage() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ["branding"], queryFn: getBranding });

  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0d6efd");
  const [colorTouched, setColorTouched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setAppName(config.appName ?? "");
      setPrimaryColor(config.primaryColor ?? "#0d6efd");
      setColorTouched(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBranding({
        appName,
        // Only send primaryColor when the Admin actually interacted with
        // the color control, or when a color override already existed —
        // otherwise a save that only changed the app name or logo would
        // silently introduce an explicit color override (the input's
        // initial state is just Bootstrap's default blue, not "no
        // opinion").
        primaryColor: colorTouched || config?.primaryColor ? primaryColor : undefined,
        logo: logoFile ?? undefined,
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearNameMutation = useMutation({
    mutationFn: () => updateBranding({ appName: "" }),
    onSuccess: () => {
      setAppName("");
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearColorMutation = useMutation({
    mutationFn: () => updateBranding({ primaryColor: "" }),
    onSuccess: () => {
      setPrimaryColor("#0d6efd");
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => updateBranding({ removeLogo: true }),
    onSuccess: () => {
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    saveMutation.mutate();
  }

  if (isLoading) return <p>Loading…</p>;

  const currentLogoUrl = absoluteLogoUrl(config?.logoUrl ?? null);

  return (
    <div className="page">
      <h1>Branding</h1>
      <p className="form-text text-muted">
        Customize this deployment's app name, logo, and accent color. Leave anything unset to keep the default look.
      </p>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && !error && <p className="alert alert-success">Saved.</p>}
      <form onSubmit={handleSubmit} className="card card-body" style={{ maxWidth: 480 }}>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-app-name">App name</label>
          <div className="input-group">
            <input
              id="branding-app-name"
              className="form-control"
              placeholder="AZM Support CRM"
              maxLength={100}
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => clearNameMutation.mutate()}
              disabled={clearNameMutation.isPending || !config?.appName}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-color">Primary color</label>
          <div className="input-group">
            <input
              id="branding-color"
              type="color"
              className="form-control form-control-color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                setColorTouched(true);
              }}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => clearColorMutation.mutate()}
              disabled={clearColorMutation.isPending || !config?.primaryColor}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-logo">Logo</label>
          {currentLogoUrl && (
            <div className="mb-2">
              <img src={currentLogoUrl} alt="Current logo" style={{ height: 40 }} />
            </div>
          )}
          <input
            id="branding-logo"
            type="file"
            className="form-control"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
          {config?.logoUrl && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-2"
              onClick={() => clearLogoMutation.mutate()}
              disabled={clearLogoMutation.isPending}
            >
              Remove logo
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
