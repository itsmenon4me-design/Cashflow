export function serializeBigInt(value: any): any {
  // Handle primitives
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((v) => serializeBigInt(v));
  }

  if (typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeBigInt(v);
    }
    return out;
  }

  // Fallback: return as-is
  return value;
}
