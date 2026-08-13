import { ApiError } from "@/lib/axios";
import type { OfflineEntity } from "@/lib/offline/storage";
import { getCachedData, setCachedData } from "@/lib/offline/storage";
import { useAuthStore } from "@/stores/auth.store";

function currentScope(): string {
  return useAuthStore.getState().user?.email ?? "";
}

function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status >= 500;
  }
  return true;
}

export function offlineScope(of?: string): string {
  return (of ?? currentScope()).toLowerCase().trim();
}

export async function withOfflineCache<T>(
  entity: OfflineEntity,
  cacheKey: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const scope = offlineScope();
  try {
    const result = await fetcher();
    if (scope) {
      void setCachedData(scope, entity, cacheKey, result);
    }
    return result;
  } catch (err) {
    if (scope && isTransient(err)) {
      const cached = await getCachedData<T>(scope, entity, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }
    throw err;
  }
}