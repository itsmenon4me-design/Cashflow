type Serialized<T> = T extends bigint
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serializeBigInt<T>(value: T): Serialized<T> {
  // Handle primitives
  if (typeof value === 'bigint') {
    return value.toString() as unknown as Serialized<T>;
  }
  if (value === null) {
    return null as unknown as Serialized<T>;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as unknown as Serialized<T>;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as Serialized<T>;
  }

  if (Array.isArray(value)) {
    return value.map((v: unknown) =>
      serializeBigInt(v),
    ) as unknown as Serialized<T>;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeBigInt(v);
    }
    return out as unknown as Serialized<T>;
  }

  // Fallback: return as-is
  return value as unknown as Serialized<T>;
}
