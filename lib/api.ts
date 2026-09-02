// En macOS, localhost puede resolver a IPv6 y competir con listeners del sistema.
// El API de desarrollo está ligado explícitamente a loopback IPv4.
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5000";

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  roles: string[];
  name: string;
};

export type EventSummary = {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  occupiedSlots: number;
  status: "Draft" | "Published" | "Active" | "Finished" | "Closed" | "Cancelled";
};

export type EventInput = {
  title: string;
  slug: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  reservationStartsAt?: string | null;
  reservationEndsAt?: string | null;
  capacity: number;
};

export type ReservationSummary = {
  id: string; eventId: string; eventTitle: string; clientId: string; clientFirstName: string; clientLastName: string; clientEmail: string;
  status: string; createdAt: string; checkedInAt: string | null; checkedOutAt: string | null;
};
export type ReservationDetail = {
  id: string; status: string; createdAt: string; checkedInAt: string | null; checkedOutAt: string | null; cancelledAt: string | null; noShowAt: string | null;
  event: { id: string; title: string; startsAt: string; status: string };
  client: { id: string; firstName: string; lastName: string; email: string; phoneNumber: string | null };
};
export type ClientSummary = { id: string; firstName: string; lastName: string; email: string; phoneNumber: string | null };
export type ClientDetail = ClientSummary & { createdAt: string; reservations: Array<{ id: string; eventId: string; eventTitle: string; eventStartsAt: string; status: string; createdAt: string; checkedInAt: string | null; checkedOutAt: string | null }> };
export type StaffSummary = { id: string; firstName: string; lastName: string; email: string; isActive: boolean; roles: string[] };
export type StaffDetail = StaffSummary & { phoneNumber: string | null; createdAt: string };

export type DashboardData = {
  activeEvent: EventSummary | null;
  eventCount: number;
  metrics: {
    capacity: number;
    occupiedSlots: number;
    availableSlots: number;
    confirmed: number;
    checkedIn: number;
    checkedOut: number;
    cancelled: number;
    noShow: number;
    insideNow: number;
  } | null;
};

export type AccessLogSummary = {
  id: string;
  reservationId: string | null;
  eventId: string | null;
  staffUserId: string;
  action: "CheckIn" | "CheckOut";
  result: string;
  createdAt: string;
  eventTitle: string | null;
  clientName: string | null;
};

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("No pudimos validar tu correo o contraseña.");
  return response.json() as Promise<Session>;
}

export async function getEvents(accessToken: string): Promise<EventSummary[]> {
  const response = await fetch(`${apiUrl}/api/admin/events`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No fue posible cargar los eventos.");
  return response.json() as Promise<EventSummary[]>;
}

async function adminRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/api/admin/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { errors?: Record<string, string[]> } | null;
    const message = data?.errors ? Object.values(data.errors).flat().join(" ") : "No fue posible completar la operación.";
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function createEvent(accessToken: string, event: EventInput) {
  return adminRequest<EventSummary>(accessToken, "events", { method: "POST", body: JSON.stringify(event) });
}

export function updateEvent(accessToken: string, eventId: string, event: EventInput) {
  return adminRequest<EventSummary>(accessToken, `events/${eventId}`, { method: "PUT", body: JSON.stringify(event) });
}

export function getAdminDetail<T>(accessToken: string, path: string) { return adminRequest<T>(accessToken, path); }
export function cancelReservation(accessToken: string, reservationId: string) { return adminRequest<void>(accessToken, `reservations/${reservationId}/cancel`, { method: "POST" }); }
export function setStaffActive(accessToken: string, userId: string, active: boolean) { return adminRequest<void>(accessToken, `staff/${userId}/${active ? "activate" : "deactivate"}`, { method: "POST" }); }
export function resetStaffPassword(accessToken: string, userId: string, newPassword: string) { return adminRequest<void>(accessToken, `staff/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }); }
export function changeEventStatus(accessToken: string, eventId: string, action: "publish" | "activate" | "close" | "finish" | "cancel") { return adminRequest<void>(accessToken, `events/${eventId}/${action}`, { method: "POST" }); }

export async function getDashboard(accessToken: string): Promise<DashboardData> {
  const response = await fetch(`${apiUrl}/api/admin/dashboard`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No fue posible cargar el dashboard.");
  return response.json() as Promise<DashboardData>;
}

export type AccessResult = { result: string; reservationId: string | null; status: string | null; processedAt: string | null };

export async function processAccess(accessToken: string, action: "check-in" | "check-out", eventId: string, token: string): Promise<AccessResult> {
  const response = await fetch(`${apiUrl}/api/access/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ eventId, token }),
  });
  if (!response.ok) throw new Error("No fue posible procesar el acceso.");
  return response.json() as Promise<AccessResult>;
}

export async function getActiveAccessEvent(accessToken: string): Promise<EventSummary | null> {
  const response = await fetch(`${apiUrl}/api/access/active-event`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No fue posible cargar el evento activo.");
  return response.json() as Promise<EventSummary | null>;
}

export async function getAdminCollection<T>(accessToken: string, path: string): Promise<T[]> {
  const response = await fetch(`${apiUrl}/api/admin/${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No fue posible cargar este módulo.");
  return response.json() as Promise<T[]>;
}
