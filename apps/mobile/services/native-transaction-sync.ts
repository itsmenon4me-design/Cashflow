export type NativeTransactionPayload = {
  category_id: string;
  transaction_type: "INCOME" | "EXPENSE";
  amount_cents: number;
  transaction_date: string;
  note?: string;
  reference_number?: string;
};

export type NativeTransactionDraft = {
  date: string;
  dateISO: string;
  category: string;
  categoryId?: string;
  note: string;
  amount: string;
  income: boolean;
};

export type NativeTransactionSyncAction = "create" | "update" | "delete";

export type NativeTransactionSyncMutation =
  | {
    entityId: string;
    action: "create" | "update";
    payload: NativeTransactionPayload;
    draft?: NativeTransactionDraft;
  }
  | {
    entityId: string;
    action: "delete";
    payload: null;
  };

export type NativeTransactionSyncRecord = {
  id: string;
  entityId: string;
  action: NativeTransactionSyncAction;
  payload: NativeTransactionPayload | null;
  draft?: NativeTransactionDraft;
  queuedAt: string;
  retries: number;
  failed: boolean;
  lastError?: string;
  nextAttemptAt?: number;
};

export type NativeTransactionSyncStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type NativeTransactionSyncExecutor = (
  record: NativeTransactionSyncRecord,
) => Promise<void>;

export type NativeTransactionSyncFlushResult = {
  succeeded: number;
  records: NativeTransactionSyncRecord[];
};

const MAX_RETRIES = 4;
const RETRY_BACKOFF_BASE_MS = 1_000;
const RETRY_BACKOFF_CAP_MS = 60_000;

export function transactionSyncStorageKey(userId: string): string {
  return `cashflow.native.sync.transactions.v1:${encodeURIComponent(userId)}`;
}

export function transactionSyncBackoffMs(retries: number): number {
  return Math.min(
    RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, retries - 1),
    RETRY_BACKOFF_CAP_MS,
  );
}

function isPayload(value: unknown): value is NativeTransactionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<NativeTransactionPayload>;
  return typeof payload.category_id === "string"
    && (payload.transaction_type === "INCOME" || payload.transaction_type === "EXPENSE")
    && typeof payload.amount_cents === "number"
    && typeof payload.transaction_date === "string"
    && (payload.note === undefined || typeof payload.note === "string")
    && (payload.reference_number === undefined || typeof payload.reference_number === "string");
}

function isDraft(value: unknown): value is NativeTransactionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<NativeTransactionDraft>;
  return typeof draft.date === "string"
    && typeof draft.dateISO === "string"
    && typeof draft.category === "string"
    && (draft.categoryId === undefined || typeof draft.categoryId === "string")
    && typeof draft.note === "string"
    && typeof draft.amount === "string"
    && typeof draft.income === "boolean";
}

function isSyncRecord(value: unknown): value is NativeTransactionSyncRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<NativeTransactionSyncRecord>;
  return typeof record.id === "string"
    && typeof record.entityId === "string"
    && (record.action === "create" || record.action === "update" || record.action === "delete")
    && (record.action === "delete"
      ? record.payload === null
      : isPayload(record.payload))
    && (record.draft === undefined || isDraft(record.draft))
    && typeof record.queuedAt === "string"
    && typeof record.retries === "number"
    && typeof record.failed === "boolean"
    && (record.lastError === undefined || typeof record.lastError === "string")
    && (record.nextAttemptAt === undefined || typeof record.nextAttemptAt === "number");
}

function isRecordNotFoundOrInvalid(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

function sortRecords(records: NativeTransactionSyncRecord[]): NativeTransactionSyncRecord[] {
  return records.sort((left, right) =>
    Date.parse(left.queuedAt) - Date.parse(right.queuedAt)
    || left.id.localeCompare(right.id),
  );
}

function nextQueuedAt(records: NativeTransactionSyncRecord[]): string {
  const latestQueuedAt = records.reduce(
    (latest, record) => Math.max(latest, Date.parse(record.queuedAt) || 0),
    0,
  );
  return new Date(Math.max(Date.now(), latestQueuedAt + 1)).toISOString();
}

export class NativeTransactionSyncQueue {
  private readonly key: string;
  private readonly storage: NativeTransactionSyncStorage;
  private serial: Promise<void> = Promise.resolve();

  constructor(userId: string, storage: NativeTransactionSyncStorage) {
    if (!userId.trim()) throw new Error("A user ID is required to scope transaction sync.");
    this.key = transactionSyncStorageKey(userId);
    this.storage = storage;
  }

  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.serial.then(task, task);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readRecords(): Promise<NativeTransactionSyncRecord[]> {
    const serialized = await this.storage.getItem(this.key);
    if (serialized === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch (error) {
      throw new Error("The saved transaction sync queue is corrupted.", { cause: error });
    }
    if (!Array.isArray(parsed) || !parsed.every(isSyncRecord)) {
      throw new Error("The saved transaction sync queue has an invalid format.");
    }
    return sortRecords(parsed);
  }

  private async writeRecords(records: NativeTransactionSyncRecord[]): Promise<void> {
    if (records.length === 0) {
      await this.storage.setItem(this.key, "[]");
      return;
    }
    await this.storage.setItem(this.key, JSON.stringify(sortRecords(records)));
  }

  getRecords(): Promise<NativeTransactionSyncRecord[]> {
    return this.runExclusive(() => this.readRecords());
  }

  clear(): Promise<void> {
    return this.runExclusive(() => this.storage.setItem(this.key, "[]"));
  }

  enqueue(
    mutation: NativeTransactionSyncMutation,
    initialRetries = 0,
  ): Promise<NativeTransactionSyncRecord[]> {
    return this.runExclusive(async () => {
      const records = await this.readRecords();
      const entityRecords = records.filter((record) => record.entityId === mutation.entityId);

      if (mutation.action === "update") {
        const pendingCreate = entityRecords.find((record) => record.action === "create");
        const pendingUpdate = entityRecords.find((record) => record.action === "update");
        const existing = pendingCreate ?? pendingUpdate;
        if (existing) {
          existing.payload = pendingCreate
            ? { ...mutation.payload, reference_number: existing.payload?.reference_number }
            : mutation.payload;
          existing.draft = mutation.draft ?? existing.draft;
          existing.failed = false;
          existing.lastError = undefined;
          existing.retries = 0;
          existing.nextAttemptAt = Date.now();
          await this.writeRecords(records);
          return records;
        }
        if (entityRecords.some((record) => record.action === "delete")) {
          throw new Error("This transaction is already queued for deletion.");
        }
      }

      if (mutation.action === "delete") {
        if (entityRecords.some((record) => record.action === "create")) {
          const remaining = records.filter((record) => record.entityId !== mutation.entityId);
          await this.writeRecords(remaining);
          return remaining;
        }
        const remaining = records.filter((record) =>
          record.entityId !== mutation.entityId || record.action === "create",
        );
        const deleteRecord: NativeTransactionSyncRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          entityId: mutation.entityId,
          action: "delete",
          payload: null,
          queuedAt: nextQueuedAt(remaining),
          retries: initialRetries,
          failed: false,
          nextAttemptAt: Date.now() + (initialRetries > 0 ? transactionSyncBackoffMs(initialRetries) : 0),
        };
        remaining.push(deleteRecord);
        await this.writeRecords(remaining);
        return sortRecords(remaining);
      }

      const record: NativeTransactionSyncRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        entityId: mutation.entityId,
        action: mutation.action,
        payload: mutation.payload,
        ...(mutation.draft ? { draft: mutation.draft } : {}),
        queuedAt: nextQueuedAt(records),
        retries: initialRetries,
        failed: false,
        nextAttemptAt: Date.now() + (initialRetries > 0 ? transactionSyncBackoffMs(initialRetries) : 0),
      };
      records.push(record);
      await this.writeRecords(records);
      return sortRecords(records);
    });
  }

  retryFailed(): Promise<NativeTransactionSyncRecord[]> {
    return this.runExclusive(async () => {
      const records = await this.readRecords();
      const retried = records.map((record) => record.failed
        ? { ...record, failed: false, retries: 0, lastError: undefined, nextAttemptAt: Date.now() }
        : record,
      );
      await this.writeRecords(retried);
      return retried;
    });
  }

  dismissFailed(): Promise<NativeTransactionSyncRecord[]> {
    return this.runExclusive(async () => {
      const records = await this.readRecords();
      const remaining = records.filter((record) => !record.failed);
      await this.writeRecords(remaining);
      return remaining;
    });
  }

  flush(
    executor: NativeTransactionSyncExecutor,
    now = Date.now(),
    shouldContinue: () => boolean = () => true,
  ): Promise<NativeTransactionSyncFlushResult> {
    return this.runExclusive(async () => {
      let records = await this.readRecords();
      let succeeded = 0;
      const due = records.filter((record) =>
        !record.failed && (record.nextAttemptAt ?? 0) <= now,
      );

      for (const record of due) {
        if (!shouldContinue()) break;
        try {
          await executor(record);
          records = records.filter((candidate) => candidate.id !== record.id);
          succeeded += 1;
        } catch (error) {
          const retries = record.retries + 1;
          record.retries = retries;
          record.lastError = error instanceof Error ? error.message : String(error);
          const failedAt = Math.max(now, Date.now());
          if (isRecordNotFoundOrInvalid(error) || retries > MAX_RETRIES) {
            record.failed = true;
            record.nextAttemptAt = undefined;
          } else {
            record.nextAttemptAt = failedAt + transactionSyncBackoffMs(retries);
          }
        }
        await this.writeRecords(records);
      }
      return { succeeded, records };
    });
  }
}
