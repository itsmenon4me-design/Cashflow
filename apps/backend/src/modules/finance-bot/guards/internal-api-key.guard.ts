import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';

/**
 * Protects internal endpoints with a shared internal API key.
 * - Expected key is read from INTERNAL_API_KEY (must be set in the environment).
 * - Supplied key is compared in constant time (sha256 digest of both values).
 * - Missing/invalid keys produce the same generic Unauthorized response; the
 *   expected key is never logged or echoed.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.INTERNAL_API_KEY;
    const provided = req.headers['x-internal-api-key'];

    if (
      typeof expected !== 'string' ||
      expected.length === 0 ||
      typeof provided !== 'string' ||
      provided.length === 0
    ) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    const expectedDigest = crypto
      .createHash('sha256')
      .update(expected)
      .digest();
    const providedDigest = crypto
      .createHash('sha256')
      .update(provided)
      .digest();

    if (!crypto.timingSafeEqual(expectedDigest, providedDigest)) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}
