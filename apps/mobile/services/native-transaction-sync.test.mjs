import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeTransactionSyncQueue,
  transactionSyncBackoffMs,
} from "./native-transaction-sync.ts";

class MemoryStorage {
  values = new Map();

  async getItem(key) {
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    this.values.set(key, value);
  }
}

const payload = {
  category_id: "category-1",
  transaction_type: "EXPENSE",
  amount_cents: 1200,
  transaction_date: "2026-05-20T10:00:00.000Z",
};

const draft = {
  date: "20 Mei 2026",
  dateISO: "2026-05-20",
  category: "Makan",
  note: "Makan siang",
  amount: "-Rp12",
  income: false,
};

test("queue persists per user and reloads records", async () => {
  const storage = new MemoryStorage();
  const first = new NativeTransactionSyncQueue("user-a", storage);
  await first.enqueue({ action: "create", entityId: "local-1", payload, draft });

  const restored = new NativeTransactionSyncQueue("user-a", storage);
  const otherAccount = new NativeTransactionSyncQueue("user-b", storage);
  assert.equal((await restored.getRecords()).length, 1);
  assert.equal((await otherAccount.getRecords()).length, 0);
});

test("create edits replace the pending payload and deleting it cancels the chain", async () => {
  const storage = new MemoryStorage();
  const queue = new NativeTransactionSyncQueue("user-a", storage);
  const changedPayload = { ...payload, amount_cents: 2500 };
  await queue.enqueue({
    action: "create",
    entityId: "local-2",
    payload: { ...payload, reference_number: "local-2" },
    draft,
  });
  await queue.enqueue({
    action: "update",
    entityId: "local-2",
    payload: changedPayload,
    draft: { ...draft, amount: "-Rp25" },
  });
  assert.equal((await queue.getRecords())[0].payload.amount_cents, 2500);
  assert.equal((await queue.getRecords())[0].payload.reference_number, "local-2");

  await queue.enqueue({ action: "delete", entityId: "local-2", payload: null });
  assert.deepEqual(await queue.getRecords(), []);
});

test("flush retries transient failures with exponential backoff", async () => {
  const storage = new MemoryStorage();
  const queue = new NativeTransactionSyncQueue("user-a", storage);
  await queue.enqueue({ action: "delete", entityId: "server-1", payload: null });
  const firstNow = Date.now() + 60_000;

  const first = await queue.flush(async () => {
    throw new TypeError("Network request failed");
  }, firstNow);
  assert.equal(first.succeeded, 0);
  assert.equal(first.records[0].retries, 1);
  assert.equal(first.records[0].nextAttemptAt, firstNow + 1_000);
  assert.equal(transactionSyncBackoffMs(2), 2_000);

  const second = await queue.flush(async () => {}, firstNow + 1_000);
  assert.equal(second.succeeded, 1);
  assert.deepEqual(second.records, []);
});

test("permanent client errors are parked and can be explicitly retried", async () => {
  const storage = new MemoryStorage();
  const queue = new NativeTransactionSyncQueue("user-a", storage);
  await queue.enqueue({ action: "delete", entityId: "server-2", payload: null });

  const failed = await queue.flush(async () => {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }, Date.now() + 60_000);
  assert.equal(failed.records[0].failed, true);
  assert.equal(failed.records[0].lastError, "Not found");

  const retried = await queue.retryFailed();
  assert.equal(retried[0].failed, false);
  assert.equal(retried[0].retries, 0);
});

test("flush stops when the authenticated account scope changes", async () => {
  const storage = new MemoryStorage();
  const queue = new NativeTransactionSyncQueue("user-a", storage);
  await queue.enqueue({ action: "delete", entityId: "server-3", payload: null });
  await queue.enqueue({ action: "delete", entityId: "server-4", payload: null });
  let scopeIsActive = true;
  const result = await queue.flush(async () => {
    scopeIsActive = false;
  }, Date.now() + 1, () => scopeIsActive);

  assert.equal(result.succeeded, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].entityId, "server-4");
});

test("dismiss failed removes parked items from the local queue only", async () => {
  const storage = new MemoryStorage();
  const queue = new NativeTransactionSyncQueue("user-a", storage);
  await queue.enqueue({ action: "delete", entityId: "server-5", payload: null });
  await queue.enqueue({ action: "delete", entityId: "server-6", payload: null }, 1);
  await queue.flush(async (record) => {
    if (record.entityId === "server-5") {
      throw Object.assign(new Error("Conflict"), { status: 409 });
    }
  }, Date.now() + 500);

  const remaining = await queue.dismissFailed();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].entityId, "server-6");
});
