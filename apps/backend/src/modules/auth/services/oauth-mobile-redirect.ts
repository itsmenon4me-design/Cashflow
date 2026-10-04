import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';

export const MOBILE_AUTH_REDIRECT_URI = 'neraca://auth/callback';

type OAuthStateRecord = {
  state?: unknown;
  redirectUri?: unknown;
  deviceId?: unknown;
};

export function validateMobileRedirectUri(redirectUri?: string): string | null {
  if (redirectUri === undefined || redirectUri === '') return null;
  if (redirectUri !== MOBILE_AUTH_REDIRECT_URI) {
    throw ErrorService.create(
      ErrorCode.INVALID_INPUT,
      'The native OAuth redirect URI is not allowed.',
    );
  }
  return MOBILE_AUTH_REDIRECT_URI;
}

export function serializeOAuthState(
  state: string,
  redirectUri: string | null,
  deviceId: string | null = null,
) {
  return redirectUri || deviceId
    ? JSON.stringify({ state, ...(redirectUri ? { redirectUri } : {}), ...(deviceId ? { deviceId } : {}) })
    : state;
}

export function parseOAuthState(
  value: string,
  expectedState: string,
): { valid: boolean; redirectUri: string | null; deviceId: string | null } {
  if (value === expectedState) return { valid: true, redirectUri: null, deviceId: null };

  let record: OAuthStateRecord;
  try {
    record = JSON.parse(value) as OAuthStateRecord;
  } catch {
    return { valid: false, redirectUri: null, deviceId: null };
  }

  if (record.state !== expectedState) return { valid: false, redirectUri: null, deviceId: null };
  if (record.redirectUri !== MOBILE_AUTH_REDIRECT_URI) {
    if (record.redirectUri !== undefined) {
      return { valid: false, redirectUri: null, deviceId: null };
    }
  }
  const deviceId = typeof record.deviceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.deviceId)
    ? record.deviceId.toLowerCase()
    : null;
  if (record.deviceId !== undefined && deviceId === null) {
    return { valid: false, redirectUri: null, deviceId: null };
  }
  return {
    valid: true,
    redirectUri: record.redirectUri === MOBILE_AUTH_REDIRECT_URI ? MOBILE_AUTH_REDIRECT_URI : null,
    deviceId,
  };
}
