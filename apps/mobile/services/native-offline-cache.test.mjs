import assert from "node:assert/strict";
import test from "node:test";
import {
  NativeOfflineCache,
  nativeOfflineCacheKey,
} from "./native-offline-cache-core.ts";

class MemoryStorage {
  values = new Map();

  async getItem(key) {
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    this.values.set(key, value);
  }

  async removeItem(key) {
    this.values.delete(key);
  }

  async getAllKeys() {
    return [...this.values.keys()];
  }

  async multiRemove(keys) {
    for (const key of keys) this.values.delete(key);
  }
}

test("offline cache falls back for transient errors only within the same account", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  const cached = [{ id: "transaction-1" }];
  await cache.withCache("user-a", "transactions", "list:all", async () => cached);

  let refreshError;
  const restored = await cache.withCache(
    "user-a",
    "transactions",
    "list:all",
    async () => {
      throw new TypeError("Network request failed");
    },
    undefined,
    (error) => { refreshError = error; },
  );
  assert.deepEqual(restored, cached);
  assert.match(refreshError.message, /Network request failed/);
  await assert.rejects(
    cache.withCache("user-b", "transactions", "list:all", async () => {
      throw new TypeError("Network request failed");
    }),
    /Network request failed/,
  );
});

test("offline cache publishes saved data before refreshing it", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  const saved = [{ id: "saved" }];
  const fresh = [{ id: "fresh" }];
  const delivered = [];
  await cache.withCache("user-a", "transactions", "list:all", async () => saved);

  const refreshed = await cache.withCache(
    "user-a",
    "transactions",
    "list:all",
    async () => fresh,
    (value) => delivered.push(value),
  );

  assert.deepEqual(delivered, [saved]);
  assert.deepEqual(refreshed, fresh);
  assert.deepEqual(
    JSON.parse(await storage.getItem(nativeOfflineCacheKey("user-a", "transactions", "list:all"))),
    fresh,
  );
});

test("cache-backed list updates preserve saved data after successful mutations", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  const key = nativeOfflineCacheKey("user-a", "budgets", "list");
  await storage.setItem(key, JSON.stringify([{ id: "budget-1" }]));

  await cache.updateCachedValue("user-a", "budgets", "list", (budgets) => [
    ...budgets.filter((budget) => budget.id !== "budget-1"),
    { id: "budget-1", amount: 500 },
  ]);

  assert.deepEqual(JSON.parse(await storage.getItem(key)), [{ id: "budget-1", amount: 500 }]);
});

test("an in-flight stale refresh cannot overwrite a successful cache mutation", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  const key = nativeOfflineCacheKey("user-a", "transactions", "list:all");
  const cached = [{ id: "older" }];
  await storage.setItem(key, JSON.stringify(cached));

  let resolveFetch;
  let markFetchStarted;
  const fetchStarted = new Promise((resolve) => {
    markFetchStarted = resolve;
  });
  const refresh = cache.withCache(
    "user-a",
    "transactions",
    "list:all",
    () => new Promise((resolve) => {
      resolveFetch = resolve;
      markFetchStarted();
    }),
  );
  await fetchStarted;

  await cache.updateCachedValue("user-a", "transactions", "list:all", (transactions) => [
    { id: "newly-created" },
    ...transactions,
  ]);
  resolveFetch([{ id: "older" }]);
  await refresh;

  assert.deepEqual(JSON.parse(await storage.getItem(key)), [
    { id: "newly-created" },
    { id: "older" },
  ]);
});

test("offline cache does not hide client errors", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  await cache.withCache("user-a", "categories", "list", async () => ["food"]);
  await assert.rejects(
    cache.withCache("user-a", "categories", "list", async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }),
    /Unauthorized/,
  );
});

test("cache invalidation removes only the selected account entity", async () => {
  const storage = new MemoryStorage();
  const cache = new NativeOfflineCache(storage);
  const transactionKey = nativeOfflineCacheKey("user-a", "transactions", "list:all");
  const budgetKey = nativeOfflineCacheKey("user-a", "budgets", "list");
  const otherUserKey = nativeOfflineCacheKey("user-b", "transactions", "list:all");
  await Promise.all([
    storage.setItem(transactionKey, "[]"),
    storage.setItem(budgetKey, "[]"),
    storage.setItem(otherUserKey, "[]"),
  ]);

  await cache.clear("user-a", "transactions");
  assert.equal(await storage.getItem(transactionKey), null);
  assert.notEqual(await storage.getItem(budgetKey), null);
  assert.notEqual(await storage.getItem(otherUserKey), null);
});
