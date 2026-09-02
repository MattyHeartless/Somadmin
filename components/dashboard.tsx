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
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { AccessLogSummary, DashboardData, EventSummary, getAdminCollection, getDashboard, getEvents } from "@/lib/api";
import { ModuleView } from "@/components/module-view";

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
  const [apiEvents, setApiEvents] = useState<EventSummary[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [accessLogs, setAccessLogs] = useState<AccessLogSummary[]>([]);
  const [apiError, setApiError] = useState("");
  const [module, setModule] = useState<"dashboard" | "events" | "reservations" | "clients" | "staff" | "access-logs">("dashboard");

  useEffect(() => {
    const load = () => Promise.all([getEvents(accessToken), getDashboard(accessToken), getAdminCollection<AccessLogSummary>(accessToken, "access-logs")])
      .then(([events, dashboardData, logs]) => { setApiEvents(events); setDashboard(dashboardData); setAccessLogs(logs); setApiError(""); })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "No fue posible cargar los eventos."));
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [accessToken]);

  const displayedEvents = (apiEvents ?? []).map((event) => ({
    name: event.title,
    date: new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)),
    fill: `${event.occupiedSlots} / ${event.capacity}`,
    status: event.status,
  }));
  const activeEvent = dashboard?.activeEvent;
  const metrics = dashboard?.metrics;
  const capacity = metrics?.capacity ?? 0;
  const occupied = metrics?.occupiedSlots ?? 0;
  const available = metrics?.availableSlots ?? 0;
  const inside = metrics?.insideNow ?? 0;
  const checkIns = metrics?.checkedIn ?? 0;
  const checkOuts = metrics?.checkedOut ?? 0;
  const occupation = capacity ? (occupied / capacity) * 100 : 0;
  const filledCapacityLines = Math.round((occupation / 100) * 25);

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
          <NavItem icon={QrCode} onClick={() => window.location.assign("/scanner")}>Scanner</NavItem>
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
            <button className="primary-button" onClick={() => window.location.assign("/scanner")}>
              <QrCode size={19} weight="bold" /> Abrir scanner
            </button>
          </div>
        </header>

        <section className="event-hero">
          <div className="hero-scrim" />
          <div className="hero-copy">
            <div className="hero-status"><span className="live-dot" /> {activeEvent ? "EN CURSO" : "SIN EVENTO ACTIVO"}</div>
            <h2>{activeEvent?.title ?? "Sin evento activo"}</h2>
            <p>{activeEvent ? new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeStyle: "short" }).format(new Date(activeEvent.startsAt)) : "Crea y activa un evento para comenzar a operar."}</p>
          </div>
          <div className="hero-meta">
            <div><span>CUPO OCUPADO</span><strong>{occupied} <i>/ {capacity}</i></strong></div>
            <button onClick={() => window.location.assign("/scanner")}>Ver acceso <ArrowUpRight size={17} /></button>
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
              {accessLogs.slice(0, 4).map((log) => (
                <div className="access-row" key={log.id}>
                  <div className={"access-symbol " + (log.action === "CheckOut" ? "out" : "success")}>{log.action === "CheckOut" ? <DoorOpen size={18} /> : <CheckCircle size={18} weight="fill" />}</div>
                  <div className="access-person"><strong>{log.clientName ?? (log.result === "Success" ? "Cliente registrado" : "Intento de acceso")}</strong><span>{log.action === "CheckOut" ? "Salida" : "Entrada"} · {log.eventTitle ?? log.result}</span></div>
                  <time>{new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(log.createdAt))}</time>
                </div>
              ))}
              {!accessLogs.length && <p className="detail-muted">Aún no hay accesos registrados.</p>}
            </div>
          </article>

          <article className="surface capacity-panel">
            <header className="panel-header"><div><p className="eyebrow">AFORO</p><h2>Estado del venue</h2></div><DotsThree size={22} /></header>
            <div className="capacity-value"><strong>{occupation.toFixed(1)}%</strong><span>ocupación actual</span></div>
            <div className="capacity-lines" aria-label={`${occupied} de ${capacity} lugares ocupados`}>
              {Array.from({ length: 25 }, (_, index) => <span key={index} className={index < filledCapacityLines ? "filled" : ""} />)}
            </div>
            <div className="capacity-footer"><span>{occupied} ocupados</span><span>{available} disponibles</span></div>
            <button className="secondary-button" onClick={() => window.location.assign("/scanner")}>Gestionar acceso <ArrowUpRight size={17} /></button>
          </article>
        </section>

        <section className="surface event-list">
          <header className="panel-header"><div><p className="eyebrow">AGENDA</p><h2>Eventos recientes y próximos</h2></div><button className="text-button" onClick={() => setModule("events")}>Todos los eventos <ArrowUpRight size={16} /></button></header>
          <div className="event-table">
            <div className="table-head"><span>EVENTO</span><span>FECHA</span><span>CUPO</span><span>ESTADO</span><span /></div>
            {displayedEvents.map((event, index) => <div className="table-row" key={event.name}>
              <div className={"event-thumb thumb-" + (index % 3)} /><strong>{event.name}</strong><span>{event.date}</span><span className="mono">{event.fill}</span><Status tone={event.status === "Active" ? "live" : event.status === "Draft" ? "draft" : "neutral"}>{event.status}</Status><button className="row-menu" aria-label={"Acciones para " + event.name}><DotsThree size={20} /></button>
            </div>)}
            {!displayedEvents.length && <div className="module-state">Aún no hay eventos creados.</div>}
          </div>
          {apiError && <p className="dashboard-error">{apiError}</p>}
        </section>
        </>}
      </section>
    </main>
  );
}
