import {
  ErrorCode,
  ErrorCodeDefaultMessage,
  ErrorCodeHttpStatusMap,
} from './error-codes';
import { AppError } from './app-error';

export class ErrorService {
  static create(
    errorCode: ErrorCode,
    message?: string,
    details?: unknown,
  ): AppError {
    const status = ErrorCodeHttpStatusMap[errorCode] ?? 500;
    const msg = message ?? ErrorCodeDefaultMessage[errorCode] ?? 'Error';
    return new AppError(errorCode, msg, status, details);
  }

  static fromHttpStatus(
    status: number,
    message?: string,
    details?: unknown,
  ): AppError {
    // find a matching error code by status, default to INTERNAL
    const entries = Object.entries(ErrorCodeHttpStatusMap) as Array<
      [ErrorCode, number]
    >;
    const found = entries.find(([, s]) => s === status);
    const code = found ? found[0] : ErrorCode.INTERNAL;
    const msg = message ?? ErrorCodeDefaultMessage[code];
    return new AppError(code, msg, status, details);
  }
}
