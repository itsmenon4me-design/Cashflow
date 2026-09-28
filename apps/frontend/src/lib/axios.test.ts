import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_REQUEST_TIMEOUT_MS,
  ApiTimeoutError,
  apiClient,
  ensureFreshAccessToken,
} from "@/lib/axios";

const authState = vi.hoisted(() => ({
  accessToken: "expired-access-token" as string | null,
  refreshToken: "refresh-token",
  accessTokenAgeMs: Number.POSITIVE_INFINITY,
}));

vi.mock("@/lib/auth-token", () => ({
  getAccessToken: () => authState.accessToken,
  getAccessTokenAgeMs: () => authState.accessTokenAgeMs,
  getRefreshToken: () => authState.refreshToken,
  setAuthTokens: (accessToken: string, refreshToken: string) => {
    authState.accessToken = accessToken;
    authState.refreshToken = refreshToken;
    authState.accessTokenAgeMs = 0;
  },
  clearAuthTokens: () => {
    authState.accessToken = null;
    authState.refreshToken = "";
  },
}));

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as Response;
}

describe("apiClient request timeout and refresh handling", () => {
  beforeEach(() => {
    authState.accessToken = "expired-access-token";
    authState.refreshToken = "refresh-token";
    authState.accessTokenAgeMs = Number.POSITIVE_INFINITY;
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shares one refresh among simultaneous requests after an expired access token", async () => {
    let releaseRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return refreshResponse;
      }
      const authorization = new Headers(init?.headers).get("Authorization");
      return Promise.resolve(
        authorization === "Bearer fresh-access-token"
          ? jsonResponse(200, { success: true })
          : jsonResponse(401, { message: "Access token expired" }),
      );
    });

    const proactiveRefresh = ensureFreshAccessToken(0);
    const requests = Array.from({ length: 12 }, (_, index) =>
      apiClient.get(`/parallel-${index}`),
    );

    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh(
      jsonResponse(201, {
        data: {
          accessToken: "fresh-access-token",
          refreshToken: "rotated-refresh-token",
        },
      }),
    );

    await expect(Promise.all(requests)).resolves.toEqual(
      Array.from({ length: 12 }, () => ({ success: true })),
    );
    await expect(proactiveRefresh).resolves.toBe(true);
    expect(refreshCalls).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(25);
    expect(authState.refreshToken).toBe("rotated-refresh-token");
  });

  it("rejects a request whose fetch never responds instead of leaving it pending", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>(() => {}));

    const pendingRequest = apiClient.get("/never-responds");
    const rejection = expect(pendingRequest).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it("also times out while reading a response body", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: () => new Promise<string>(() => {}),
    } as Response);

    const pendingRequest = apiClient.get("/body-never-responds");
    const rejection = expect(pendingRequest).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it("rejects simultaneous requests when the shared refresh request hangs", async () => {
    vi.useFakeTimers();
    let refreshCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(jsonResponse(401, { message: "Access token expired" }));
    });

    const requests = Array.from({ length: 8 }, (_, index) =>
      apiClient.get(`/refresh-hang-${index}`),
    );
    const rejections = requests.map((request) =>
      expect(request).rejects.toBeInstanceOf(ApiTimeoutError),
    );
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await Promise.all(rejections);

    expect(refreshCalls).toBe(1);
  });
});
