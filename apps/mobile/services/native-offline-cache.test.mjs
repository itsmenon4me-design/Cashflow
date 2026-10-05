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

  const restored = await cache.withCache("user-a", "transactions", "list:all", async () => {
    throw new TypeError("Network request failed");
  });
  assert.deepEqual(restored, cached);
  await assert.rejects(
    cache.withCache("user-b", "transactions", "list:all", async () => {
      throw new TypeError("Network request failed");
    }),
    /Network request failed/,
  );
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
