import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NativeOfflineCache,
  type NativeOfflineEntity,
} from "./native-offline-cache-core";

let currentScope = "";
const offlineCache = new NativeOfflineCache(AsyncStorage);

export function setNativeOfflineCacheScope(userId: string | null | undefined): void {
  currentScope = userId?.trim() ?? "";
}

export function getNativeOfflineCacheScope(): string {
  return currentScope;
}

export async function invalidateNativeOfflineEntity(
  entity: NativeOfflineEntity,
  userId = currentScope,
): Promise<void> {
  if (!userId) return;
  try {
    await offlineCache.clear(userId, entity);
  } catch (error) {
    console.error(`Could not invalidate cached native ${entity} data after a server update.`, error);
  }
}

export async function updateNativeOfflineCache<T>(
  entity: NativeOfflineEntity,
  key: string,
  update: (value: T) => T,
  userId = currentScope,
): Promise<void> {
  if (!userId) return;
  try {
    await offlineCache.updateCachedValue(userId, entity, key, update);
  } catch (error) {
    console.error(`Could not update cached native ${entity} data after a server update.`, error);
  }
}

export async function invalidateNativeFinancialAggregates(userId = currentScope): Promise<void> {
  await Promise.all(
    (["reports", "analytics", "forecasts"] as const).map(async (entity) => {
      await invalidateNativeOfflineEntity(entity, userId);
    }),
  );
}

export function withNativeOfflineCache<T>(
  entity: NativeOfflineEntity,
  key: string,
  fetcher: () => Promise<T>,
  onCached?: (value: T) => void,
  onRefreshError?: (error: unknown) => void,
): Promise<T> {
  return offlineCache.withCache(currentScope, entity, key, fetcher, onCached, onRefreshError);
}

export function clearNativeOfflineCache(
  userId: string,
  entity?: NativeOfflineEntity,
): Promise<void> {
  return offlineCache.clear(userId, entity);
}
