import { getAccessToken, getRefreshToken, setAuthTokens, clearAuthTokens } from "@/lib/auth-token";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  refresh?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const json: unknown = await response.json();
    const data = typeof json === "object" && json !== null && "data" in json
      ? (json as { data?: { accessToken?: string; refreshToken?: string } }).data
      : undefined;

    if (data?.accessToken && data.refreshToken) {
      setAuthTokens(data.accessToken, data.refreshToken);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  clearAuthTokens();
  try {
    if (typeof window !== "undefined") {
      const path = "/login";
      if (window.location.pathname !== path) {
        window.dispatchEvent(new CustomEvent("cashflow:client-route", { detail: path }));
      }
    }
  } catch (e) {
    // In restricted runtimes, navigation may be unsupported — fail silently
  }
}

async function handleUnauthorized(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;

  if (!refreshed) {
    redirectToLogin();
  }

  return refreshed;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }
  return `${BASE_URL}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;
}

async function request<T>(
  path: string,
  method: string,
  options: RequestOptions = {},
  body?: unknown,
): Promise<T> {
  const { headers = {}, params, refresh = true } = options;

  const url = buildUrl(path, params);
  const accessToken = getAccessToken();

  const doFetch = (token: string | null) =>
    fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await doFetch(accessToken);

  if (response.status === 401 && refresh) {
    const refreshed = await handleUnauthorized();
    if (refreshed) {
      response = await doFetch(getAccessToken());
    }
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "POST", options, body),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "PATCH", options, body),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, "DELETE", options),
};
