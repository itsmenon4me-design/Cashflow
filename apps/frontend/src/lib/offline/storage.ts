import { IDB_STORES, idbDeleteByPrefix, idbGet, idbPut } from "@/lib/offline/idb";

export type OfflineEntity =
  | "transactions"
  | "accounts"
  | "categories"
  | "budgets"
  | "saving-goals";

const prefix = "cfg";

export function offlineCacheKey(
  scope: string,
  entity: OfflineEntity,
  key: string,
): string {
  return `${prefix}:${scope}:${entity}:${key}`;
}

function scopePrefix(scope: string): string {
  return `${prefix}:${scope}:`;
}

export async function getCachedData<T>(
  scope: string,
  entity: OfflineEntity,
  key: string,
): Promise<T | undefined> {
  const value = await idbGet<T>(IDB_STORES.ENTITY_CACHE, offlineCacheKey(scope, entity, key));
  return value;
}

export async function setCachedData(
  scope: string,
  entity: OfflineEntity,
  key: string,
  value: unknown,
): Promise<void> {
  await idbPut(IDB_STORES.ENTITY_CACHE, { id: offlineCacheKey(scope, entity, key), value });
}

export async function clearCachedEntity(
  scope: string,
  entity: OfflineEntity,
): Promise<void> {
  if (!scope) {
    return;
  }
  await idbDeleteByPrefix(IDB_STORES.ENTITY_CACHE, offlineCacheKey(scope, entity, ""));
}

export async function clearOfflineUserData(scope: string): Promise<void> {
  if (!scope) {
    return;
  }
  await idbDeleteByPrefix(IDB_STORES.ENTITY_CACHE, scopePrefix(scope));
  await idbDeleteByPrefix(IDB_STORES.SYNC_QUEUE, scopePrefix(scope));
}