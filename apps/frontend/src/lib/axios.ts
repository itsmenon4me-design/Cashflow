export interface HttpRequestConfig {
  headers?: Record<string, string>;
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super("Request failed");
  }
}

class HttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data as T;
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "GET",
      headers,
    });
  }

  post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  }

  patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers,
    });
  }

  delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method: "DELETE",
      headers,
    });
  }
}

export const apiClient = new HttpClient();
