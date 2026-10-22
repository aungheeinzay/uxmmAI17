export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super("API request failed");
    this.name = "ApiError";
  }
}

function apiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("Invalid API configuration");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new ApiError(0, "CONFIGURATION_ERROR");
  }
}

export async function postJson(path: string, body: unknown): Promise<unknown> {
  const url = `${apiBaseUrl()}${path}`;
  return requestJson(url, body, "omit");
}

export async function postSessionJson(path: string, body: unknown = {}): Promise<unknown> {
  return requestJson(`/api/session/${path}`, body, "same-origin");
}

export async function getSessionJson(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const suffix = query.toString();
  return requestJson(`/api/session/${path}${suffix ? `?${suffix}` : ""}`, undefined, "same-origin");
}

async function requestJson(url: string, body: unknown, credentials: RequestCredentials): Promise<unknown> {
  let response: Response;
  const method = body === undefined ? "GET" : "POST";
  try {
    response = await fetch(url, {
      method, headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), credentials, cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError") {
      throw new ApiError(0, "REQUEST_TIMEOUT");
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new ApiError(0, "OFFLINE");
    throw new ApiError(0, "NETWORK_ERROR");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof payload === "object" && payload !== null && "error" in payload
      && typeof payload.error === "object" && payload.error !== null && "code" in payload.error
      && typeof payload.error.code === "string" ? payload.error.code : "UNKNOWN_ERROR";
    throw new ApiError(response.status, code);
  }
  return payload;
}
