import { ErrorCode } from './error-codes';

export class AppError extends Error {
  public readonly errorCode: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    errorCode: ErrorCode,
    message?: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message ?? errorCode);
    this.errorCode = errorCode;
    this.statusCode = statusCode ?? 500;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
