export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

export async function getAdminCollection<T>(accessToken: string, path: string): Promise<T[]> {
  const response = await fetch(`${apiUrl}/api/admin/${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("No fue posible cargar este módulo.");
  return response.json() as Promise<T[]>;
}
