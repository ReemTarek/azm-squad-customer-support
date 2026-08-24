import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { extractApiErrorMessage } from "../lib/apiClient";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function RegisterPage() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, name);
      navigate("/", { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-language-switcher"><LanguageSwitcher /></div>
      <form onSubmit={handleSubmit} className="auth-form">
        <h1>{t("auth.createAccount")}</h1>
        <p className="form-hint">{t("auth.customerHint")}</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>
          {t("auth.name")}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t("auth.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t("auth.password")}
          <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.creatingAccount") : t("auth.createAccountButton")}
        </button>
        <p>
          {t("auth.alreadyHaveAccount")} <Link to="/login">{t("auth.signIn")}</Link>
        </p>
      </form>
    </div>
  );
}
