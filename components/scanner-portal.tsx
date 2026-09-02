"use client";

import { ArrowClockwise, CheckCircle, DoorOpen, QrCode, SignOut, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { EventSummary, getActiveAccessEvent, processAccess, Session } from "@/lib/api";

const storageKey = "soma-admin-session";
type Mode = "Entrada" | "Salida";

export function ScannerPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [mode, setMode] = useState<Mode>("Entrada");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadActiveEvent(accessToken: string) {
    setLoading(true);
    try { setEvent(await getActiveAccessEvent(accessToken)); }
    catch (reason) { setResult({ success: false, message: reason instanceof Error ? reason.message : "No fue posible cargar el evento." }); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) { window.location.replace("/"); return; }
    try {
      const next = JSON.parse(stored) as Session;
      if (!next.roles.some(role => role === "Admin" || role === "AccessStaff")) { window.location.replace("/"); return; }
      setSession(next);
      void loadActiveEvent(next.accessToken);
    } catch { window.localStorage.removeItem(storageKey); window.location.replace("/"); }
  }, []);

  async function submit() {
    if (!session || !event || !token.trim()) return;
    setBusy(true); setResult(null);
    try {
      const response = await processAccess(session.accessToken, mode === "Entrada" ? "check-in" : "check-out", event.id, token);
      const success = response.result === "Success";
      setResult({ success, message: success ? `${mode} registrada correctamente.` : response.result });
      if (success) setToken("");
    } catch (reason) { setResult({ success: false, message: reason instanceof Error ? reason.message : "No fue posible procesar el acceso." }); }
    finally { setBusy(false); }
  }

  function logout() { window.localStorage.removeItem(storageKey); window.location.assign("/"); }

  if (!session) return <main className="scanner-page scanner-loading">Cargando acceso operativo...</main>;
  return <main className="scanner-page">
    <header className="scanner-topbar"><div className="scanner-brand">SOMA<span>&gt;</span><small>ACCESS CONTROL</small></div><div className="scanner-topbar-actions">{session.roles.includes("Admin") && <a href="/" className="scanner-admin-link">Administración</a>}<button className="scanner-logout" onClick={logout}><SignOut size={18} /> Salir</button></div></header>
    <section className="scanner-workspace">
      <div className="scanner-context"><p className="eyebrow">CONTROL DE PUERTA</p><h1>Escaneo de acceso</h1><p>Valida entradas y salidas para el evento activo.</p></div>
      <section className="scanner-console" aria-label="Consola de escaneo">
        <header className="scanner-console-header"><div><p className="eyebrow">EVENTO ACTIVO</p><h2>{loading ? "Cargando evento..." : event?.title ?? "No hay evento activo"}</h2></div><button className="icon-button" aria-label="Actualizar evento activo" onClick={() => void loadActiveEvent(session.accessToken)}><ArrowClockwise size={18} /></button></header>
        <div className="scanner-console-body">
          {!loading && !event && <div className="scanner-empty"><WarningCircle size={32} weight="duotone" /><strong>El escaneo no está disponible</strong><p>Un administrador debe activar un evento antes de abrir accesos.</p></div>}
          {(loading || event) && <>
            <div className="scanner-mode-switch" role="group" aria-label="Modo de acceso">{(["Entrada", "Salida"] as const).map(item => <button key={item} onClick={() => { setMode(item); setResult(null); }} className={mode === item ? "mode-active" : ""}>{item === "Entrada" ? <CheckCircle size={18} weight="bold" /> : <DoorOpen size={18} weight="bold" />}{item}</button>)}</div>
            <div className="scanner-reader"><span className="scanner-corners" /><QrCode size={72} weight="thin" /><strong>{mode === "Entrada" ? "LISTO PARA CHECK-IN" : "LISTO PARA CHECK-OUT"}</strong><p>Escanea el código QR o captura el token manualmente.</p></div>
            <label className="scanner-token-label">Token QR<input autoFocus value={token} onChange={item => setToken(item.target.value)} onKeyDown={item => { if (item.key === "Enter") { item.preventDefault(); void submit(); } }} placeholder="Pega o escribe el token del QR" disabled={!event || busy} /></label>
            <button className="scanner-submit" onClick={() => void submit()} disabled={!event || !token.trim() || busy}>{mode === "Entrada" ? <CheckCircle size={20} weight="bold" /> : <DoorOpen size={20} weight="bold" />}{busy ? "Validando..." : `Registrar ${mode.toLowerCase()}`}</button>
            {result && <div className={`scanner-feedback ${result.success ? "is-success" : "is-error"}`}>{result.success ? <CheckCircle size={27} weight="fill" /> : <XCircle size={27} weight="fill" />}<div><strong>{result.success ? "Acceso autorizado" : "Acceso no autorizado"}</strong><p>{result.message}</p></div></div>}
          </>}
        </div>
      </section>
    </section>
  </main>;
}
