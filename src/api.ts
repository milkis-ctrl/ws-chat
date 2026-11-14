import { API_URL, ENDPOINTS } from "./config";

let accessToken: string | null = null;

function formatError(data: unknown, status: number): string {
  if (!data || typeof data !== "object") return `Ошибка ${status}`;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === "string") return d.detail;
  const parts = Object.entries(d).map(
    ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`
  );
  return parts.join("\n") || `Ошибка ${status}`;
}

async function postJson(path: string, body?: unknown, auth = false) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(API_URL + path, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatError(data, res.status));
  return data;
}

export async function register(username: string, password: string) {
  const data = await postJson(ENDPOINTS.register, { username, password });
  accessToken = data.access;
}

export async function login(username: string, password: string) {
  const data = await postJson(ENDPOINTS.login, { username, password });
  accessToken = data.access;
}

/** Просит новый access по refresh-cookie. false: сессии нет или она истекла. */
export async function refreshAccess(): Promise<boolean> {
  try {
    const data = await postJson(ENDPOINTS.refresh);
    accessToken = data.access;
    return true;
  } catch {
    accessToken = null;
    return false;
  }
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.exp * 1000 < Date.now() + 5000;
  } catch {
    return true;
  }
}

/** Возвращает действующий access, при необходимости обновляя его. */
export async function getValidAccess(): Promise<string | null> {
  if (accessToken && !isExpired(accessToken)) return accessToken;
  return (await refreshAccess()) ? accessToken : null;
}

export async function logout() {
  try {
    await getValidAccess();
    await postJson(ENDPOINTS.logout, undefined, true);
  } catch {
    // если сервер недоступен, всё равно выходим локально
  } finally {
    accessToken = null;
  }
}