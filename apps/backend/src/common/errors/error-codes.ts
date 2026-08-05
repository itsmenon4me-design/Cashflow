export enum ErrorCode {
  // Client errors
  INVALID_INPUT = 'ERR_INVALID_INPUT',
  UNAUTHORIZED = 'ERR_UNAUTHORIZED',
  FORBIDDEN = 'ERR_FORBIDDEN',
  NOT_FOUND = 'ERR_NOT_FOUND',
  CONFLICT = 'ERR_CONFLICT',

  // Auth related
  INVALID_CREDENTIALS = 'ERR_INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'ERR_TOKEN_EXPIRED',
  INVALID_TOKEN = 'ERR_INVALID_TOKEN',
  EXPIRED_TOKEN = 'ERR_EXPIRED_TOKEN',
  RATE_LIMIT = 'ERR_RATE_LIMIT',

  // Server errors
  INTERNAL = 'ERR_INTERNAL',

  // Placeholder for domain-specific codes
  DOMAIN_ERROR = 'ERR_DOMAIN',
}

export const ErrorCodeHttpStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 400,
  [ErrorCode.EXPIRED_TOKEN]: 400,
  [ErrorCode.RATE_LIMIT]: 429,
  [ErrorCode.INTERNAL]: 500,
  [ErrorCode.DOMAIN_ERROR]: 400,
};

export const ErrorCodeDefaultMessage: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_INPUT]: 'Invalid input',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
  [ErrorCode.FORBIDDEN]: 'Forbidden',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.CONFLICT]: 'Conflict',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ErrorCode.TOKEN_EXPIRED]: 'Token expired',
  [ErrorCode.INVALID_TOKEN]: 'Invalid token',
  [ErrorCode.EXPIRED_TOKEN]: 'Expired token',
  [ErrorCode.RATE_LIMIT]: 'Too many requests',
  [ErrorCode.INTERNAL]: 'Internal server error',
  [ErrorCode.DOMAIN_ERROR]: 'Domain error',
};
