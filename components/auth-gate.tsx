"use client";

import { Eye, EyeSlash, LockKey, WarningCircle } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard";
import { Session, login } from "@/lib/api";

const storageKey = "soma-admin-session";

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try { setSession(JSON.parse(stored) as Session); } catch { window.localStorage.removeItem(storageKey); }
    }
    setReady(true);
  }, []);

  function handleSession(next: Session) {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    window.localStorage.removeItem(storageKey);
    setSession(null);
  }

  if (!ready) return <main className="startup"><span className="startup-logo">SOMA&gt;</span></main>;
  if (session) return <Dashboard accessToken={session.accessToken} userName={session.name} onLogout={logout} />;
  return <LoginScreen onSession={handleSession} />;
}

function LoginScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try { onSession(await login(email, password)); } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible iniciar sesión.");
    } finally { setPending(false); }
  }

  return <main className="login-page">
    <section className="login-art" aria-hidden="true">
      <div className="login-logo">SOMA<span>&gt;</span><small>MUSIC HUB</small></div>
      <div className="login-copy"><p>CONTROL OPERATIVO</p><h1>La noche<br />en control.</h1><span>Eventos, aforo y acceso en una sola consola.</span></div>
    </section>
    <section className="login-panel">
      <form onSubmit={submit}>
        <p className="eyebrow">ACCESO DE STAFF</p>
        <h1>Bienvenido.</h1>
        <p className="login-intro">Inicia sesión con tus credenciales de SOMA.</p>
        <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Contraseña<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeSlash size={19} /> : <Eye size={19} />}</button></span></label>
        {error && <p className="form-error"><WarningCircle size={18} weight="fill" />{error}</p>}
        <button className="login-submit" disabled={pending}>{pending ? "Validando..." : <><LockKey size={18} weight="bold" />Ingresar al admin</>}</button>
      </form>
    </section>
  </main>;
}
