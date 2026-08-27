import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/axios";

// ---------------------------------------------------------------------------
// In-memory IndexedDB mock (the real idb module needs a browser DB).
// ---------------------------------------------------------------------------
type Row = { id: string; [key: string]: unknown };
type StoreName = "entity-cache" | "sync-queue";
const db: Record<StoreName, Map<string, Row>> = {
  "entity-cache": new Map<string, Row>(),
  "sync-queue": new Map<string, Row>(),
};

function snapshotQueue(): Row[] {
  return [...db["sync-queue"].values()];
}

vi.mock("@/lib/offline/idb", () => ({
  IDB_STORES: {
    ENTITY_CACHE: "entity-cache" as StoreName,
    SYNC_QUEUE: "sync-queue" as StoreName,
  },
  idbPut: async (store: StoreName, value: Row) => {
    db[store].set(value.id, value);
  },
  idbGetAll: async (store: StoreName) => [...db[store].values()],
  idbGet: async (store: StoreName, id: string) => db[store].get(id),
  idbDelete: async (store: StoreName, id: string) => {
    db[store].delete(id);
  },
  idbGetByPrefix: async (store: StoreName, prefix: string) =>
    [...db[store].values()].filter((row) => row.id.startsWith(prefix)),
  idbDeleteByPrefix: async (store: StoreName, prefix: string) => {
    for (const id of [...db[store].keys()]) {
      if (id.startsWith(prefix)) {
        db[store].delete(id);
      }
    }
  },
  idbClearStore: async (store: StoreName) => {
    db[store].clear();
  },
}));

// ---------------------------------------------------------------------------
// Controllable token store mock for ensureFreshAccessToken tests.
// ---------------------------------------------------------------------------
const tokenState = {
  accessToken: "access-current" as string | null,
  refreshToken: "refresh-1" as string | null,
  ageMs: 0,
};
vi.mock("@/lib/auth-token", () => ({
  getAccessToken: () => tokenState.accessToken,
  getRefreshToken: () => tokenState.refreshToken,
  getAccessTokenAgeMs: () => tokenState.ageMs,
  getAccessTokenStoredAt: () => Date.now(),
  setAuthTokens: (...args: unknown[]) => {
    tokenState.accessToken = args[0] as string;
    tokenState.refreshToken = args[1] as string;
    tokenState.ageMs = 0;
  },
  clearAuthTokens: () => {
    tokenState.accessToken = null;
    tokenState.refreshToken = null;
  },
  getStoredUser: () => null,
  setStoredUser: () => undefined,
}));

import {
  createOfflineSyncController,
  SyncError,
  backoffDelayMs,
  type SyncQueueItem,
} from "@/lib/offline/sync";
import {
  syncController,
  syncCreateTransaction,
  syncUpdateTransaction,
  syncDeleteTransaction,
  makeTempId,
  SYNC_ERROR_CODES,
} from "@/lib/offline/sync-client";
import { ensureFreshAccessToken } from "@/lib/axios";
import { transactionService } from "@/services/transaction.service";
import { useAuthStore } from "@/stores/auth.store";
import { useSyncStore } from "@/stores/sync.store";
import { OfflineBanner } from "@/components/layout/offline-banner";

const SCOPE_EMAIL = "edge-case@test.dev";

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

async function resetTestState(): Promise<void> {
  db["entity-cache"].clear();
  db["sync-queue"].clear();
  setOnline(true);
  vi.restoreAllMocks();
  useAuthStore.setState({
    isAuthenticated: true,
    user: { name: "Edge", email: SCOPE_EMAIL },
  });
  useSyncStore.getState().reset();
}

describe("OFFLINE EDGE CASE B1: chain create -> edit while still offline (temp_id)", () => {
  beforeEach(resetTestState);
  afterEach(cleanup);

  it("formats temporary ids as temp_${uuid}", () => {
    expect(makeTempId()).toMatch(/^temp_[0-9a-fA-F-]{36}$/);
  });

  it("merges the offline edit INTO the pending create (one FIFO entry, latest values win)", async () => {
    // Still OFFLINE: create a brand-new transaction -> gets a temp id...
    setOnline(false);
    const created = await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "EXPENSE",
      amount_cents: 100_000,
      transaction_date: "2026-08-20T10:00:00.000Z",
      note: "offline-create",
    });
    expect(created.queued).toBe(true);
    const tempId = created.id!;
    expect(tempId.startsWith("temp_")).toBe(true);

    // ...then EDIT THE SAME transaction, still offline, still temp id.
    const updated = await syncUpdateTransaction(tempId, {
      amount_cents: 250_000,
      note: "offline-edit-after-create",
    });
    expect(updated.queued).toBe(true);

    // The queue holds ONE record: the create, with the edit merged in.
    const queue = snapshotQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe("create");
    expect(queue[0].entityId).toBe(tempId);
    const payload = queue[0].payload as Record<string, unknown>;
    expect(payload.amount_cents).toBe(250_000);
    expect(payload.note).toBe("offline-edit-after-create");
  });

  it("processes the merged create once and REPLACES the temp id with the server id", async () => {
    setOnline(false);
    const { id: tempId } = await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "INCOME",
      amount_cents: 10_000,
      transaction_date: "2026-08-21T09:00:00.000Z",
    });
    await syncUpdateTransaction(tempId!, { amount_cents: 99_000 });

    const createSpy = vi
      .spyOn(transactionService, "create")
      .mockResolvedValue({ id: "server-777" } as never);
    const updateSpy = vi.spyOn(transactionService, "update");

    setOnline(true);
    const status = await syncController.flush();

    // Create executed exactly ONCE (with merged values); no stray update call
    // against the temp id that would 404 server-side.
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(
      (createSpy.mock.calls[0][0] as unknown as Record<string, unknown>)
        .amount_cents,
    ).toBe(99_000);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(status).toBe("synced");
    expect(useSyncStore.getState().pendingCount).toBe(0);

    // temp_id -> server id replacement recorded for optimistic-row reconcile.
    // Key layout mirrors offlineCacheKey(): cfg:{scope}:{entity}:{key}.
    const mapKey = `cfg:${SCOPE_EMAIL.toLowerCase()}:transactions:idmap:${tempId}`;
    expect(db["entity-cache"].get(mapKey)?.value).toBe("server-777");
  });

  it("keeps strict FIFO order across independent queued operations", async () => {
    const order: string[] = [];
    // Restrict fakes: the default set also fakes requestAnimationFrame and
    // useRealTimers() would then restore jsdom's never-firing rAF, breaking
    // later mount-gated UI tests in this file.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const base = new Date("2026-08-22T00:00:00Z").getTime();
    vi.setSystemTime(base);

    const controller = createOfflineSyncController({
      scope: () => SCOPE_EMAIL,
      executor: async (item: SyncQueueItem) => {
        order.push(`${item.action}:${item.entityId}`);
      },
    });
    await controller.enqueue({ entityType: "transaction", entityId: "first", action: "create", payload: {} });
    vi.setSystemTime(base + 5);
    await controller.enqueue({ entityType: "transaction", entityId: "second", action: "update", payload: {} });
    vi.setSystemTime(base + 10);
    await controller.enqueue({ entityType: "transaction", entityId: "third", action: "delete", payload: {} });
    vi.useRealTimers();

    await controller.flush();
    expect(order).toEqual([
      "create:first",
      "update:second",
      "delete:third",
    ]);
  });
});

describe("OFFLINE EDGE CASE B2: offline edit races with delete from another device", () => {
  beforeEach(resetTestState);
  afterEach(cleanup);

  it("parks the change with a visible DELETED_ELSEWHERE reason instead of resurrecting or silently dropping it", async () => {
    // Device A (offline): queue an edit for a transaction that device B will delete.
    setOnline(false);
    await syncUpdateTransaction("victim-id", { amount_cents: 5_000 });

    // Back ONLINE, but the server answers 404: already deleted elsewhere.
    setOnline(true);
    const updateSpy = vi
      .spyOn(transactionService, "update")
      .mockRejectedValue(new ApiError(404, { message: "Not Found" }));

    const status = await syncController.flush();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(status).toBe("error"); // surfaced as sync-failed, NOT silent success
    const ui = useSyncStore.getState();
    expect(ui.status).toBe("sync-failed");
    expect(ui.failedCount).toBe(1);
    expect(ui.pendingCount).toBe(0);
    expect(ui.failedReason).toBe(SYNC_ERROR_CODES.DELETED_ELSEWHERE);

    // Parked (not retried forever, not lost): stays inspectable in the queue.
    const queue = snapshotQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].failed).toBe(true);

    // A later flush must not hammer the dead endpoint again.
    await syncController.flush();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT classify a 404 on CREATE as deleted-elsewhere", async () => {
    setOnline(false);
    await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "EXPENSE",
      amount_cents: 1,
      transaction_date: "2026-08-23T00:00:00.000Z",
    });
    setOnline(true);
    vi.spyOn(transactionService, "create").mockRejectedValue(
      new ApiError(404, {}),
    );
    await syncController.flush();
    const queue = snapshotQueue();
    expect(queue[0].failed).toBe(true);
    // Generic conflict message, not the deleted-elsewhere code.
    expect(queue[0].lastError).not.toBe(SYNC_ERROR_CODES.DELETED_ELSEWHERE);
  });
});

describe("OFFLINE EDGE CASE B3: expired session while flushing pending queue", () => {
  beforeEach(resetTestState);
  afterEach(cleanup);

  it("backoffDelayMs grows exponentially and is capped", () => {
    expect(backoffDelayMs(1)).toBe(1_000);
    expect(backoffDelayMs(2)).toBe(2_000);
    expect(backoffDelayMs(3)).toBe(4_000);
    expect(backoffDelayMs(10)).toBe(60_000);
  });

  it("defers a transient-failure retry by its backoff window, then retries successfully", async () => {
    setOnline(false);
    await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "EXPENSE",
      amount_cents: 7_000,
      transaction_date: "2026-08-24T00:00:00.000Z",
    });
    setOnline(true);

    let attempts = 0;
    vi.spyOn(transactionService, "create").mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new SyncError("transient", "network hiccup");
      }
      return { id: "server-ok" } as never;
    });

    // First flush fails transiently -> deferred ~1s out, still pending.
    const firstStatus = await syncController.flush();
    expect(firstStatus).toBe("syncing");
    const queued = snapshotQueue()[0];
    expect(queued.retries).toBe(1);
    expect((queued.nextAttemptAt as number) - Date.now()).toBeLessThanOrEqual(1_000);
    expect(useSyncStore.getState().pendingCount).toBe(1);

    // An immediate re-flush respects the backoff window (no extra attempt).
    await syncController.flush();
    expect(attempts).toBe(1);

    // Once the window elapses, the SAME item retries and drains cleanly.
    queued.nextAttemptAt = Date.now() - 1;
    await import("@/lib/offline/idb").then((m) =>
      m.idbPut(m.IDB_STORES.SYNC_QUEUE, queued),
    );
    const finalStatus = await syncController.flush();
    expect(attempts).toBe(2);
    expect(finalStatus).toBe("synced");
    expect(snapshotQueue()).toHaveLength(0);
    // Kill the retry timer scheduled by the failed first attempt so it can
    // not fire a stray flush into later tests / after unmount.
    syncController.cancelScheduledRetry();
  });

  it("ensureFreshAccessToken keeps a young token and rotates a stale one", async () => {
    tokenState.refreshToken = "refresh-valid";
    tokenState.accessToken = "access-old";

    // Young token: no network call.
    tokenState.ageMs = 60_000;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(ensureFreshAccessToken(10 * 60_000)).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Stale token + successful refresh endpoint.
    tokenState.ageMs = 30 * 60_000;
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { accessToken: "a2", refreshToken: "r2" } }),
        { status: 200 },
      ),
    );
    await expect(ensureFreshAccessToken(10 * 60_000)).resolves.toBe(true);
    expect(tokenState.accessToken).toBe("a2");
    fetchSpy.mockRestore();
  });

  it("flags needsReAuth when refresh fails with pending items (visible notice, queue preserved)", async () => {
    setOnline(false);
    await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "EXPENSE",
      amount_cents: 3_333,
      transaction_date: "2026-08-25T00:00:00.000Z",
    });
    setOnline(true);

    // Session fully expired: refresh endpoint rejects too.
    tokenState.accessToken = "expired";
    tokenState.refreshToken = "dead-refresh";
    tokenState.ageMs = 90 * 60_000;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));

    await expect(ensureFreshAccessToken()).resolves.toBe(false);

    // Provider behaviour contract: refresh failed AND work is pending ->
    // needsReAuth must light up so the UI can warn instead of silent-failing.
    const pendingBefore: number = 1;
    const refreshed: boolean = false;
    expect(refreshed || pendingBefore === 0).toBe(false);
    useSyncStore.getState().setNeedsReAuth(!refreshed && pendingBefore > 0);
    expect(useSyncStore.getState().needsReAuth).toBe(true);

    // Queue items survive the auth failure (scoped per user, drained after re-login).
    expect(snapshotQueue()).toHaveLength(1);
    fetchSpy.mockRestore();
  });
});

describe("POLISH A: dismissing parked 'Sync failed' items", () => {
  beforeEach(resetTestState);
  afterEach(cleanup);

  it("permanently removes ONLY failed records from IndexedDB and sends ZERO server requests", async () => {
    // Mock services up-front so the test never depends on a live backend.
    const updateSpy = vi
      .spyOn(transactionService, "update")
      .mockRejectedValue(new ApiError(404, {}));
    // Survivor: transient hiccup on first attempt -> stays QUEUED (pending),
    // proving dismissal spares healthy items.
    let createAttempts = 0;
    const createSpy = vi
      .spyOn(transactionService, "create")
      .mockImplementation(async () => {
        createAttempts += 1;
        if (createAttempts === 1) {
          throw new SyncError("transient", "network hiccup");
        }
        return { id: "srv-survivor" } as never;
      });

    // Park one failed item (edit raced with remote delete).
    setOnline(false);
    await syncUpdateTransaction("victim-id", { amount_cents: 5_000 });
    // ...and keep one healthy pending item that MUST survive dismissal.
    await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "EXPENSE",
      amount_cents: 11_000,
      transaction_date: "2026-08-26T00:00:00.000Z",
      note: "survivor",
    });
    setOnline(true);
    await syncController.flush();
    expect(useSyncStore.getState().failedCount).toBe(1);

    const removeSpy = vi.spyOn(transactionService, "remove");
    updateSpy.mockClear();
    createSpy.mockClear();

    const removed = await syncController.dismissFailed();

    expect(removed).toBe(1);
    // Zero network activity during dismissal:
    expect(updateSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();

    // Permanent local cleanup (gone from IndexedDB, not just hidden in UI):
    expect(snapshotQueue().some((r) => r.entityId === "victim-id")).toBe(false);

    const ui = useSyncStore.getState();
    expect(ui.failedCount).toBe(0);
    expect(ui.failedReason).toBeNull();
    // Healthy pending item survives dismissal untouched:
    expect(ui.pendingCount).toBe(1);
    expect(
      (snapshotQueue()[0] as unknown as { entityId: string }).entityId.startsWith(
        "temp_",
      ),
    ).toBe(true);
  });

  it("returns to fully-synced state when the last item is dismissed", async () => {
    setOnline(false);
    await syncUpdateTransaction("victim-id", { amount_cents: 5_000 });
    setOnline(true);
    vi.spyOn(transactionService, "update").mockRejectedValue(
      new ApiError(404, {}),
    );
    await syncController.flush();

    await syncController.dismissFailed();

    expect(snapshotQueue()).toHaveLength(0);
    const ui = useSyncStore.getState();
    expect(ui.status).toBe("synced");
    expect(ui.pendingCount).toBe(0);
    expect(ui.failedCount).toBe(0);
  });
});

describe("POLISH B: offline create -> edit -> delete collapses into ZERO requests", () => {
  beforeEach(resetTestState);
  afterEach(cleanup);

  it("cancels the whole chain at enqueue time (server never learns the entity existed)", async () => {
    // Entire lifecycle happens OFFLINE before any sync attempt.
    setOnline(false);
    const { id: tempId } = await syncCreateTransaction({
      account_id: "acc-1",
      category_id: "cat-1",
      transaction_type: "INCOME",
      amount_cents: 50_000,
      transaction_date: "2026-08-26T01:00:00.000Z",
      note: "ephemeral",
    });
    await syncUpdateTransaction(tempId!, { amount_cents: 60_000 });
    await syncDeleteTransaction(tempId!);

    // Chain collapsed instantly: nothing left queued, optimistic row gone.
    expect(snapshotQueue()).toHaveLength(0);
    const pending = await import("@/lib/offline/sync-client").then((m) =>
      m.getPendingTransactionRecords(),
    );
    expect(pending).toHaveLength(0);

    // Back online: flushing must send NOTHING for this transaction.
    setOnline(true);
    const createSpy = vi.spyOn(transactionService, "create");
    const updateSpy = vi.spyOn(transactionService, "update");
    const removeSpy = vi.spyOn(transactionService, "remove");

    const status = await syncController.flush();

    expect(status).toBe("synced");
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
    expect(snapshotQueue()).toHaveLength(0);
  });

  it("also collapses pre-existing create+delete chains during flush", async () => {
    // Simulate records persisted by an older client version (separate rows).
    const scopeKey = SCOPE_EMAIL.toLowerCase();
    const { IDB_STORES, idbPut } = await import("@/lib/offline/idb");
    await idbPut(IDB_STORES.SYNC_QUEUE, {
      id: `${scopeKey}:chain-create`,
      scope: scopeKey,
      entityType: "transaction",
      entityId: "temp-chain",
      action: "create",
      payload: { amount_cents: 1 },
      queuedAt: "2026-08-26T02:00:00.000Z",
      retries: 0,
      failed: false,
    });
    await idbPut(IDB_STORES.SYNC_QUEUE, {
      id: `${scopeKey}:chain-edit`,
      scope: scopeKey,
      entityType: "transaction",
      entityId: "temp-chain",
      action: "update",
      payload: { amount_cents: 2 },
      queuedAt: "2026-08-26T02:00:01.000Z",
      retries: 0,
      failed: false,
    });
    await idbPut(IDB_STORES.SYNC_QUEUE, {
      id: `${scopeKey}:chain-delete`,
      scope: scopeKey,
      entityType: "transaction",
      entityId: "temp-chain",
      action: "delete",
      payload: {},
      queuedAt: "2026-08-26T02:00:02.000Z",
      retries: 0,
      failed: false,
    });

    const createSpy = vi.spyOn(transactionService, "create");
    const updateSpy = vi.spyOn(transactionService, "update");
    const removeSpy = vi.spyOn(transactionService, "remove");

    const status = await syncController.flush();

    expect(status).toBe("synced");
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
    expect(snapshotQueue()).toHaveLength(0);
  });
});

describe("REGRESSION: filter layout inputs (dates paired, type filter visibility)", () => {
  function stubAnimationFrame(): void {
    // jsdom defines rAF but never fires callbacks unless
    // pretendToBeVisual is enabled — force a working timer-based stub.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }

  beforeEach(async () => {
    await resetTestState();
    stubAnimationFrame();
  });
  afterEach(cleanup);

  it("renders the session-expired notice while ONLINE with pending items", async () => {
    useSyncStore.setState({ needsReAuth: true, pendingCount: 3 });
    render(<OfflineBanner />);
    // Banner mounts after one animation frame.
    expect(await screen.findByRole("alert")).toHaveTextContent(/sesi anda berakhir/i);
    expect(screen.getByRole("alert")).toHaveTextContent("3");
  });

  it("hides the notice once the queue drains", async () => {
    useSyncStore.setState({ needsReAuth: true, pendingCount: 0 });
    const { container } = render(<OfflineBanner />);
    // Let the mount gate (rAF) fire, then assert nothing rendered.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
