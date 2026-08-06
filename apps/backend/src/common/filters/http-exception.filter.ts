import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  success: false;
  message: string;
  errorCode?: string;
  errors?: Array<{ field?: string; message: string }>;
  timestamp: string;
  path: string;
  requestId?: string;
  statusCode: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errorCode: string | undefined = undefined;
    let errors: Array<{ field?: string; message: string }> | undefined =
      undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        if (typeof body.message === 'string') {
          message = body.message;
        } else if (Array.isArray(body.message)) {
          // AppValidationPipe returns array of {field,message}
          errors = body.message.map((m) => ({ message: String(m) }));
          message = 'Validation Error';
        } else if (Array.isArray(body.errors)) {
          const rawErrors = body.errors as unknown;
          if (Array.isArray(rawErrors)) {
            errors = rawErrors.map((item) => {
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                return {
                  field: typeof obj.field === 'string' ? obj.field : undefined,
                  message:
                    typeof obj.message === 'string'
                      ? obj.message
                      : obj
                        ? JSON.stringify(obj)
                        : String(obj),
                };
              }
              return { message: String(item) };
            });
          }
          message = (body.message as string | undefined) ?? message;
        }

        if (typeof body['errorCode'] === 'string') {
          errorCode = body['errorCode'];
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception.stack,
      );
      message = exception.message || message;
    } else {
      this.logger.error(
        `Unhandled non-error exception on ${request.method} ${request.url}: ${String(exception)}`,
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      message,
      errorCode,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.correlationId,
      statusCode,
    };

    response.status(statusCode).json(body);
  }
}
