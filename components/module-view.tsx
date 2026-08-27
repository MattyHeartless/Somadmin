"use client";

import { ArrowClockwise, ArrowLeft, CalendarBlank, CheckCircle, Clock, UsersThree } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getAdminCollection } from "@/lib/api";

type ModuleName = "events" | "reservations" | "clients" | "staff" | "access-logs";
type Row = Record<string, unknown>;

const config: Record<ModuleName, { title: string; caption: string; endpoint: string; icon: typeof CalendarBlank; columns: { key: string; label: string }[] }> = {
  events: { title: "Eventos", caption: "Agenda, cupo y estado operativo.", endpoint: "events", icon: CalendarBlank, columns: [{ key: "title", label: "EVENTO" }, { key: "startsAt", label: "INICIO" }, { key: "occupiedSlots", label: "OCUPADO" }, { key: "capacity", label: "CUPO" }, { key: "status", label: "ESTADO" }] },
  reservations: { title: "Reservaciones", caption: "Consulta el estado de cada acceso.", endpoint: "reservations", icon: CheckCircle, columns: [{ key: "id", label: "ID" }, { key: "eventId", label: "EVENTO" }, { key: "status", label: "ESTADO" }, { key: "createdAt", label: "CREADA" }] },
  clients: { title: "Clientes", caption: "Perfiles registrados e información de contacto.", endpoint: "clients", icon: UsersThree, columns: [{ key: "firstName", label: "NOMBRE" }, { key: "lastName", label: "APELLIDO" }, { key: "email", label: "CORREO" }, { key: "phoneNumber", label: "TELÉFONO" }] },
  staff: { title: "Staff", caption: "Colaboradores con acceso al sistema.", endpoint: "staff", icon: UsersThree, columns: [{ key: "firstName", label: "NOMBRE" }, { key: "lastName", label: "APELLIDO" }, { key: "email", label: "CORREO" }, { key: "roles", label: "ROL" }, { key: "isActive", label: "ESTADO" }] },
  "access-logs": { title: "Registro de accesos", caption: "Auditoría de entradas y salidas.", endpoint: "access-logs", icon: Clock, columns: [{ key: "action", label: "ACCIÓN" }, { key: "result", label: "RESULTADO" }, { key: "eventId", label: "EVENTO" }, { key: "createdAt", label: "HORA" }] },
};

function format(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (key.endsWith("At")) return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Activo" : "Inactivo";
  if (key === "id" || key.endsWith("Id")) return String(value).slice(0, 8);
  return String(value);
}

export function ModuleView({ module, accessToken, onBack }: { module: ModuleName; accessToken: string; onBack: () => void }) {
  const current = config[module];
  const Icon = current.icon;
  const tableStyle = { gridTemplateColumns: `repeat(${current.columns.length}, minmax(130px, 1fr))` };
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load() {
    setState("loading");
    try { setRows(await getAdminCollection<Row>(accessToken, current.endpoint)); setState("ready"); }
    catch { setState("error"); }
  }

  useEffect(() => { load(); }, [module, accessToken]);

  return <section className="module-page">
    <header className="module-header">
      <div><button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Dashboard</button><p className="eyebrow">ADMINISTRACIÓN</p><h1><Icon size={28} weight="duotone" /> {current.title}</h1><p>{current.caption}</p></div>
      <button className="secondary-button module-refresh" onClick={load}><ArrowClockwise size={17} /> Actualizar</button>
    </header>
    <section className="surface module-table-wrap">
      {state === "loading" && <div className="module-state">Cargando información...</div>}
      {state === "error" && <div className="module-state error-state">No fue posible cargar el módulo. Intenta actualizar.</div>}
      {state === "ready" && rows.length === 0 && <div className="module-state">Aún no hay registros para mostrar.</div>}
      {state === "ready" && rows.length > 0 && <div className="module-table">
        <div className="module-table-head" style={tableStyle}>{current.columns.map(column => <span key={column.key}>{column.label}</span>)}</div>
        {rows.map((row, index) => <div className="module-table-row" style={tableStyle} key={String(row.id ?? index)}>
          {current.columns.map(column => <span key={column.key} title={String(row[column.key] ?? "")}>{format(row[column.key], column.key)}</span>)}
        </div>)}
      </div>}
    </section>
  </section>;
}
