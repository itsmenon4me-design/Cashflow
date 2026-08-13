import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';

export function normalizeAmountCents(
  value: unknown,
  fieldName = 'amount_cents',
): bigint {
  if (value === undefined || value === null || value === '') {
    throw ErrorService.create(
      ErrorCode.INVALID_INPUT,
      `${fieldName} is required`,
    );
  }

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `${fieldName} must be a whole integer cent value`,
      );
    }

    if (!Number.isSafeInteger(value)) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `${fieldName} exceeds safe integer limits`,
      );
    }

    return BigInt(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^[-+]?\d+$/.test(trimmed)) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `${fieldName} must be a whole integer cent value`,
      );
    }

    if (trimmed === '-' || trimmed === '+') {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `${fieldName} must be a whole integer cent value`,
      );
    }

    const parsed = BigInt(trimmed);
    const safeLimit = BigInt(Number.MAX_SAFE_INTEGER);
    const safeFloor = BigInt(Number.MIN_SAFE_INTEGER);
    if (parsed > safeLimit || parsed < safeFloor) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `${fieldName} exceeds safe integer limits`,
      );
    }

    return parsed;
  }

  throw ErrorService.create(
    ErrorCode.INVALID_INPUT,
    `${fieldName} must be a whole integer cent value`,
  );
}
