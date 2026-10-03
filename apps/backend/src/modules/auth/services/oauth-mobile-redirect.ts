import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';

export const MOBILE_AUTH_REDIRECT_URI = 'neraca://auth/callback';

type OAuthStateRecord = {
  state?: unknown;
  redirectUri?: unknown;
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

export function serializeOAuthState(state: string, redirectUri: string | null) {
  return redirectUri ? JSON.stringify({ state, redirectUri }) : state;
}

export function parseOAuthState(
  value: string,
  expectedState: string,
): { valid: boolean; redirectUri: string | null } {
  if (value === expectedState) return { valid: true, redirectUri: null };

  let record: OAuthStateRecord;
  try {
    record = JSON.parse(value) as OAuthStateRecord;
  } catch {
    return { valid: false, redirectUri: null };
  }

  if (record.state !== expectedState) return { valid: false, redirectUri: null };
  if (record.redirectUri !== MOBILE_AUTH_REDIRECT_URI) {
    return { valid: false, redirectUri: null };
  }
  return { valid: true, redirectUri: MOBILE_AUTH_REDIRECT_URI };
}
