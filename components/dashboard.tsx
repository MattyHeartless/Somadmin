"use client";

import {
  ArrowUpRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  DoorOpen,
  DotsThree,
  House,
  MagnifyingGlass,
  QrCode,
  SignOut,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { DashboardData, EventSummary, getDashboard, getEvents, processAccess } from "@/lib/api";
import { ModuleView } from "@/components/module-view";

type ScanState = "idle" | "success" | "duplicate" | "error";

const accessRows = [
  { name: "Adrián Morales", action: "Entrada", time: "23:48", status: "success" },
  { name: "Maya Thompson", action: "Entrada", time: "23:43", status: "success" },
  { name: "Damián Reyes", action: "Salida", time: "23:39", status: "out" },
  { name: "Sofía Ortega", action: "Entrada", time: "23:31", status: "success" },
];

const events = [
  { name: "SOMA Afterdark: Edgar Cal", date: "Hoy · 22:00", fill: "184 / 250", status: "Activo" },
  { name: "Velvet Frequency", date: "Sáb · 21:00", fill: "96 / 180", status: "Publicado" },
  { name: "Room 02: Open Format", date: "Vie · 22:30", fill: "0 / 140", status: "Draft" },
];

function NavItem({ active, children, icon: Icon, onClick }: { active?: boolean; children: string; icon: typeof House; onClick?: () => void }) {
  return (
    <button className={active ? "nav-item nav-active" : "nav-item"} onClick={onClick}>
      <Icon size={19} weight={active ? "fill" : "regular"} />
      <span>{children}</span>
    </button>
  );
}

function Status({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "live" | "draft" }) {
  return <span className={"status status-" + tone}>{children}</span>;
}

function Metric({ value, label, note, accent }: { value: string; label: string; note: string; accent?: boolean }) {
  return (
    <article className={accent ? "metric metric-accent" : "metric"}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

export function Dashboard({ accessToken, userName, onLogout }: { accessToken: string; userName: string; onLogout: () => void }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [mode, setMode] = useState<"Entrada" | "Salida">("Entrada");
  const [apiEvents, setApiEvents] = useState<EventSummary[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [apiError, setApiError] = useState("");
  const [scanToken, setScanToken] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [module, setModule] = useState<"dashboard" | "events" | "reservations" | "clients" | "staff" | "access-logs">("dashboard");

  useEffect(() => {
    const load = () => Promise.all([getEvents(accessToken), getDashboard(accessToken)])
      .then(([events, dashboardData]) => { setApiEvents(events); setDashboard(dashboardData); })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "No fue posible cargar los eventos."));
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [accessToken]);

  const displayedEvents = apiEvents?.map((event) => ({
    name: event.title,
    date: new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)),
    fill: `${event.occupiedSlots} / ${event.capacity}`,
    status: event.status,
  })) ?? events;
  const activeEvent = dashboard?.activeEvent;
  const metrics = dashboard?.metrics;
  const activeTitle = activeEvent?.title ?? "SOMA Afterdark: Edgar Cal";
  const capacity = metrics?.capacity ?? 250;
  const occupied = metrics?.occupiedSlots ?? 184;
  const available = metrics?.availableSlots ?? 66;
  const inside = metrics?.insideNow ?? 132;
  const checkIns = metrics?.checkedIn ?? 147;
  const checkOuts = metrics?.checkedOut ?? 15;

  async function processManualAccess() {
    if (!activeEvent || !scanToken.trim()) return;
    try {
      const result = await processAccess(accessToken, mode === "Entrada" ? "check-in" : "check-out", activeEvent.id, scanToken);
      setScanMessage(result.result);
      setScanState(result.result === "Success" ? "success" : "error");
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "Error de acceso.");
      setScanState("error");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="SOMA Music Hub">SOMA<span>&gt;</span></div>
        <p className="brand-subtitle">MUSIC HUB</p>
        <nav aria-label="Navegación principal">
          <p className="nav-section">OPERACIÓN</p>
          <NavItem active={module === "dashboard"} icon={House} onClick={() => setModule("dashboard")}>Dashboard</NavItem>
          <NavItem active={module === "events"} icon={CalendarBlank} onClick={() => setModule("events")}>Eventos</NavItem>
          <NavItem active={module === "reservations"} icon={UsersThree} onClick={() => setModule("reservations")}>Reservaciones</NavItem>
          <NavItem active={module === "clients"} icon={UsersThree} onClick={() => setModule("clients")}>Clientes</NavItem>
          <NavItem active={module === "staff"} icon={UsersThree} onClick={() => setModule("staff")}>Staff</NavItem>
          <p className="nav-section nav-section-space">ACCESO</p>
          <NavItem icon={QrCode} onClick={() => { setModule("dashboard"); setScannerOpen(true); }}>Scanner</NavItem>
          <NavItem active={module === "access-logs"} icon={Clock} onClick={() => setModule("access-logs")}>Registro de accesos</NavItem>
        </nav>
        <div className="staff-card">
          <div className="avatar">{userName.split(" ").map(word => word[0]).join("").slice(0, 2)}</div>
          <div><strong>{userName}</strong><span>Administrador</span></div>
          <button className="logout-button" onClick={onLogout} aria-label="Cerrar sesión"><SignOut size={18} /></button>
        </div>
      </aside>

      <section className="workspace">
        {module !== "dashboard" ? <ModuleView module={module} accessToken={accessToken} onBack={() => setModule("dashboard")} /> : <>
        <header className="topbar">
          <div><p className="eyebrow">CONTROL OPERATIVO</p><h1>Buenas noches, {userName.split(" ")[0]}.</h1></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Buscar"><MagnifyingGlass size={21} /></button>
            <button className="primary-button" onClick={() => { setScannerOpen(true); setScanState("idle"); }}>
              <QrCode size={19} weight="bold" /> Abrir scanner
            </button>
          </div>
        </header>

        <section className="event-hero">
          <div className="hero-scrim" />
          <div className="hero-copy">
            <div className="hero-status"><span className="live-dot" /> EN CURSO</div>
            <h2>{activeTitle}</h2>
            <p>Hoy, 22:00 - 04:00 · Sala principal</p>
          </div>
          <div className="hero-meta">
            <div><span>CUPO OCUPADO</span><strong>{occupied} <i>/ {capacity}</i></strong></div>
            <button onClick={() => setScannerOpen(true)}>Ver acceso <ArrowUpRight size={17} /></button>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Métricas del evento">
          <Metric value={String(available)} label="DISPONIBLES" note="lugares restantes" accent />
          <Metric value={String(inside)} label="DENTRO AHORA" note="personas actualmente dentro" />
          <Metric value={String(checkIns)} label="CHECK-INS" note="desde el inicio" />
          <Metric value={String(checkOuts)} label="SALIDAS" note="cupo liberado" />
        </section>

        <section className="dashboard-grid">
          <article className="surface access-feed">
            <header className="panel-header">
              <div><p className="eyebrow">EVENTO ACTIVO</p><h2>Últimos accesos</h2></div>
              <button className="text-button" onClick={() => setModule("access-logs")}>Ver registro <ArrowUpRight size={16} /></button>
            </header>
            <div className="access-list">
              {accessRows.map((row) => (
                <div className="access-row" key={row.name}>
                  <div className={"access-symbol " + row.status}>{row.status === "out" ? <DoorOpen size={18} /> : <CheckCircle size={18} weight="fill" />}</div>
                  <div className="access-person"><strong>{row.name}</strong><span>{row.action} registrada</span></div>
                  <time>{row.time}</time>
                </div>
              ))}
            </div>
          </article>

          <article className="surface capacity-panel">
            <header className="panel-header"><div><p className="eyebrow">AFORO</p><h2>Estado del venue</h2></div><DotsThree size={22} /></header>
            <div className="capacity-value"><strong>73.6%</strong><span>ocupación actual</span></div>
            <div className="capacity-lines" aria-label="184 de 250 lugares ocupados">
              {Array.from({ length: 25 }, (_, index) => <span key={index} className={index < 18 ? "filled" : ""} />)}
            </div>
            <div className="capacity-footer"><span>184 ocupados</span><span>66 disponibles</span></div>
            <button className="secondary-button" onClick={() => setScannerOpen(true)}>Gestionar acceso <ArrowUpRight size={17} /></button>
          </article>
        </section>

        <section className="surface event-list">
          <header className="panel-header"><div><p className="eyebrow">AGENDA</p><h2>Eventos recientes y próximos</h2></div><button className="text-button" onClick={() => setModule("events")}>Todos los eventos <ArrowUpRight size={16} /></button></header>
          <div className="event-table">
            <div className="table-head"><span>EVENTO</span><span>FECHA</span><span>CUPO</span><span>ESTADO</span><span /></div>
            {displayedEvents.map((event, index) => <div className="table-row" key={event.name}>
              <div className={"event-thumb thumb-" + (index % 3)} /><strong>{event.name}</strong><span>{event.date}</span><span className="mono">{event.fill}</span><Status tone={event.status === "Activo" || event.status === "Active" ? "live" : event.status === "Draft" ? "draft" : "neutral"}>{event.status}</Status><button className="row-menu" aria-label={"Acciones para " + event.name}><DotsThree size={20} /></button>
            </div>)}
          </div>
          {apiError && <p className="dashboard-error">{apiError}</p>}
        </section>
        </>}
      </section>

      {scannerOpen && <div className="scanner-layer" role="dialog" aria-modal="true" aria-label="Scanner de acceso">
        <section className="scanner">
          <header className="scanner-header"><button className="icon-button" onClick={() => setScannerOpen(false)}>×</button><div><span>EVENTO ACTIVO</span><strong>SOMA Afterdark: Edgar Cal</strong></div><button className="scanner-mode">{mode}</button></header>
          <div className="mode-switch" role="group" aria-label="Modo de acceso">
            {(["Entrada", "Salida"] as const).map((item) => <button onClick={() => { setMode(item); setScanState("idle"); }} className={mode === item ? "mode-active" : ""} key={item}>{item}</button>)}
          </div>
          <div className="camera-window" aria-label="Área de cámara del scanner">
            <span className="scan-frame" /><QrCode size={56} weight="thin" /><small>LECTOR DE CÓDIGO QR</small>
          </div>
          <div className="scan-prompt"><QrCode size={22} /><p>Apunta la cámara al código QR o ingresa el token.</p><input value={scanToken} onChange={(event) => setScanToken(event.target.value)} placeholder="Token QR" /><button onClick={processManualAccess} disabled={!activeEvent || !scanToken.trim()}>Validar</button></div>
          {scanState === "success" && <div className="scan-result success"><CheckCircle size={39} weight="fill" /><div><span>{mode.toUpperCase()} AUTORIZADA</span><strong>{scanMessage}</strong><p>Acceso registrado</p></div><button onClick={() => { setScanState("idle"); setScanToken(""); }}>Siguiente</button></div>}
          {scanState === "error" && <div className="scan-result duplicate"><XCircle size={39} weight="fill" /><div><span>ACCESO NO AUTORIZADO</span><strong>{scanMessage}</strong><p>Verifica el evento y el estado del QR.</p></div><button onClick={() => setScanState("idle")}>Reintentar</button></div>}
          {scanState === "duplicate" && <div className="scan-result duplicate"><XCircle size={39} weight="fill" /><div><span>QR YA UTILIZADO</span><strong>Entrada registrada</strong><p>23:31 · Adrián Morales</p></div></div>}
        </section>
      </div>}
    </main>
  );
}
