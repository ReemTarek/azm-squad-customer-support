import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { extractApiErrorMessage } from "../lib/apiClient";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useBranding } from "../context/BrandingContext";

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const { appName, logoUrl } = useBranding();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page min-vh-100 d-flex align-items-center justify-content-center bg-light position-relative">
      <div className="position-absolute top-0 end-0 m-3"><LanguageSwitcher /></div>
      <form onSubmit={handleSubmit} className="auth-form card p-4 shadow-sm">
        {(appName || logoUrl) && (
          <div className="d-flex align-items-center gap-2 mb-3">
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 32 }} />}
            <span className="fw-bold fs-5">{appName ?? t("nav.brand")}</span>
          </div>
        )}
        <h1>{t("auth.signIn")}</h1>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="mb-3">
          <label className="form-label">{t("auth.email")}</label>
          <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">{t("auth.password")}</label>
          <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
          {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
        <p>
          {t("auth.noAccount")} <Link to="/register">{t("auth.register")}</Link>
        </p>
      </form>
    </div>
  );
}
