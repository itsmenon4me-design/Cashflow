import type {
  ApiResponse,
  ErrorResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

export class ResponseBuilder {
  static success<TData>(
    data: TData,
    message = 'Success',
    meta: PaginationMeta | Record<string, unknown> = {},
  ): ApiResponse<TData, PaginationMeta | Record<string, unknown>> {
    return {
      success: true,
      message,
      data,
      meta,
    };
  }

  static error(message: string, errors: string[] = []): ErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}
