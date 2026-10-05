export type NativeOfflineEntity =
  | "transactions"
  | "categories"
  | "budgets"
  | "saving-goals";

export type NativeOfflineCacheStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
};

const STORAGE_PREFIX = "cashflow.native.read-cache.v1";

export function nativeOfflineCacheKey(
  userId: string,
  entity: NativeOfflineEntity,
  key: string,
): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${entity}:${encodeURIComponent(key)}`;
}

function shouldUseCache(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const status = (error as { status?: unknown }).status;
  return typeof status !== "number" || status >= 500;
}

export class NativeOfflineCache {
  private readonly storage: NativeOfflineCacheStorage;

  constructor(storage: NativeOfflineCacheStorage) {
    this.storage = storage;
  }

  async withCache<T>(
    userId: string,
    entity: NativeOfflineEntity,
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const scope = userId.trim();
    if (!scope) return fetcher();

    const cacheKey = nativeOfflineCacheKey(scope, entity, key);
    try {
      const result = await fetcher();
      void this.storage.setItem(cacheKey, JSON.stringify(result)).catch((error: unknown) => {
        console.error(`Could not cache native ${entity} data for offline use.`, error);
      });
      return result;
    } catch (error) {
      if (!shouldUseCache(error)) throw error;
      const cachedValue = await this.storage.getItem(cacheKey);
      if (cachedValue === null) throw error;
      try {
        return JSON.parse(cachedValue) as T;
      } catch (cacheError) {
        console.error(`Saved native ${entity} offline data is corrupted.`, cacheError);
        await this.storage.removeItem(cacheKey);
        throw error;
      }
    }
  }

  async clear(userId: string, entity?: NativeOfflineEntity): Promise<void> {
    const scope = userId.trim();
    if (!scope) return;
    const prefix = entity
      ? nativeOfflineCacheKey(scope, entity, "")
      : `${STORAGE_PREFIX}:${encodeURIComponent(scope)}:`;
    const keys = await this.storage.getAllKeys();
    const matchingKeys = keys.filter((key) => key.startsWith(prefix));
    if (matchingKeys.length > 0) await this.storage.multiRemove(matchingKeys);
  }
}
