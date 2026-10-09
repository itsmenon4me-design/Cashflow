export type NativeOfflineEntity =
  | "transactions"
  | "categories"
  | "budgets"
  | "saving-goals"
  | "investments"
  | "reports"
  | "analytics"
  | "forecasts";

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
  private readonly revisions = new Map<string, number>();

  constructor(storage: NativeOfflineCacheStorage) {
    this.storage = storage;
  }

  private revision(cacheKey: string): number {
    return this.revisions.get(cacheKey) ?? 0;
  }

  private markChanged(cacheKey: string): void {
    this.revisions.set(cacheKey, this.revision(cacheKey) + 1);
  }

  async withCache<T>(
    userId: string,
    entity: NativeOfflineEntity,
    key: string,
    fetcher: () => Promise<T>,
    onCached?: (value: T) => void,
    onRefreshError?: (error: unknown) => void,
  ): Promise<T> {
    const scope = userId.trim();
    if (!scope) return fetcher();

    const cacheKey = nativeOfflineCacheKey(scope, entity, key);
    const initialRevision = this.revision(cacheKey);
    let cachedValue: T | undefined;
    let hasCachedValue = false;
    try {
      const serializedValue = await this.storage.getItem(cacheKey);
      if (serializedValue !== null) {
        let parsedResult: { value: T } | null = null;
        try {
          parsedResult = { value: JSON.parse(serializedValue) as T };
        } catch (error) {
          console.error(`Saved native ${entity} offline data is corrupted.`, error);
          try {
            await this.storage.removeItem(cacheKey);
          } catch (removeError) {
            console.error(`Could not remove corrupted native ${entity} offline data.`, removeError);
          }
        }
        if (parsedResult && initialRevision === this.revision(cacheKey)) {
          try {
            onCached?.(parsedResult.value);
            cachedValue = parsedResult.value;
            hasCachedValue = true;
          } catch (error) {
            console.error(`Saved native ${entity} offline data could not be restored.`, error);
            try {
              await this.storage.removeItem(cacheKey);
            } catch (removeError) {
              console.error(`Could not remove invalid native ${entity} offline data.`, removeError);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Could not read cached native ${entity} data.`, error);
    }

    try {
      const result = await fetcher();
      if (initialRevision === this.revision(cacheKey)) {
        try {
          await this.storage.setItem(cacheKey, JSON.stringify(result));
        } catch (error) {
          console.error(`Could not cache native ${entity} data for offline use.`, error);
        }
      }
      return result;
    } catch (error) {
      if (!shouldUseCache(error) || !hasCachedValue) throw error;
      onRefreshError?.(error);
      return cachedValue as T;
    }
  }

  async updateCachedValue<T>(
    userId: string,
    entity: NativeOfflineEntity,
    key: string,
    update: (value: T) => T,
  ): Promise<void> {
    const scope = userId.trim();
    if (!scope) return;

    const cacheKey = nativeOfflineCacheKey(scope, entity, key);
    this.markChanged(cacheKey);
    const serializedValue = await this.storage.getItem(cacheKey);
    if (serializedValue === null) return;

    let currentValue: T;
    try {
      currentValue = JSON.parse(serializedValue) as T;
    } catch (error) {
      console.error(`Saved native ${entity} offline data is corrupted.`, error);
      await this.storage.removeItem(cacheKey);
      return;
    }

    await this.storage.setItem(cacheKey, JSON.stringify(update(currentValue)));
  }

  async clear(userId: string, entity?: NativeOfflineEntity): Promise<void> {
    const scope = userId.trim();
    if (!scope) return;
    const prefix = entity
      ? nativeOfflineCacheKey(scope, entity, "")
      : `${STORAGE_PREFIX}:${encodeURIComponent(scope)}:`;
    const keys = await this.storage.getAllKeys();
    const matchingKeys = keys.filter((key) => key.startsWith(prefix));
    if (matchingKeys.length > 0) {
      for (const key of matchingKeys) this.markChanged(key);
      await this.storage.multiRemove(matchingKeys);
    }
  }
}
