import {
  Injectable,
  BadRequestException,
  ValidationPipe,
  ValidationError,
} from '@nestjs/common';

function flattenValidationErrors(
  errors: ValidationError[],
): Array<{ field: string; message: string }> {
  const result: Array<{ field: string; message: string }> = [];

  function walk(errs: ValidationError[], parentPath?: string) {
    for (const err of errs) {
      const path = parentPath ? `${parentPath}.${err.property}` : err.property;
      if (err.constraints) {
        for (const key of Object.keys(err.constraints)) {
          result.push({ field: path, message: err.constraints[key] });
        }
      }
      if (err.children && err.children.length) {
        walk(err.children, path);
      }
    }
  }

  walk(errors);
  return result;
}

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const flat = flattenValidationErrors(errors);
        return new BadRequestException({
          success: false,
          message: 'Validation failed',
          errors: flat,
        });
      },
    });
  }
}
