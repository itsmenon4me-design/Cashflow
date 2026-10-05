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

export async function invalidateNativeOfflineEntity(entity: NativeOfflineEntity): Promise<void> {
  if (!currentScope) return;
  try {
    await offlineCache.clear(currentScope, entity);
  } catch (error) {
    console.error(`Could not invalidate cached native ${entity} data after a server update.`, error);
  }
}

export function withNativeOfflineCache<T>(
  entity: NativeOfflineEntity,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  return offlineCache.withCache(currentScope, entity, key, fetcher);
}

export function clearNativeOfflineCache(
  userId: string,
  entity?: NativeOfflineEntity,
): Promise<void> {
  return offlineCache.clear(userId, entity);
}
