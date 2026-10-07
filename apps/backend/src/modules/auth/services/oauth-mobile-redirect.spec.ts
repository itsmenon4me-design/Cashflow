import {
  MOBILE_AUTH_REDIRECT_URI,
  parseOAuthState,
  serializeOAuthState,
  validateMobileRedirectUri,
  validateOAuthDeviceId,
} from './oauth-mobile-redirect';

describe('native OAuth redirect validation', () => {
  it('allows only the registered application callback', () => {
    expect(validateMobileRedirectUri()).toBeNull();
    expect(validateMobileRedirectUri(MOBILE_AUTH_REDIRECT_URI)).toBe(
      MOBILE_AUTH_REDIRECT_URI,
    );
    expect(() =>
      validateMobileRedirectUri('https://attacker.example/callback'),
    ).toThrow('The native OAuth redirect URI is not allowed.');
  });

  it('keeps web state compatible and stores a validated mobile callback', () => {
    expect(serializeOAuthState('state-1', null)).toBe('state-1');
    expect(parseOAuthState('state-1', 'state-1')).toEqual({
      valid: true,
      redirectUri: null,
      deviceId: null,
    });

    const stored = serializeOAuthState('state-2', MOBILE_AUTH_REDIRECT_URI);
    expect(parseOAuthState(stored, 'state-2')).toEqual({
      valid: true,
      redirectUri: MOBILE_AUTH_REDIRECT_URI,
      deviceId: null,
    });
  });

  it('preserves a validated installation id in OAuth state', () => {
    const deviceId = '123e4567-e89b-42d3-a456-426614174000';
    expect(validateOAuthDeviceId(deviceId)).toBe(deviceId);
    expect(validateOAuthDeviceId()).toBeNull();
    const stored = serializeOAuthState('state-device', null, deviceId);

    expect(parseOAuthState(stored, 'state-device')).toEqual({
      valid: true,
      redirectUri: null,
      deviceId,
    });
  });

  it('rejects malformed device identifiers before starting OAuth', () => {
    expect(() => validateOAuthDeviceId('not-a-device-id')).toThrow(
      'The OAuth device identifier is invalid.',
    );
  });

  it('rejects missing, mismatched, and unregistered state payloads', () => {
    expect(parseOAuthState('not-json', 'state-3')).toEqual({
      valid: false,
      redirectUri: null,
      deviceId: null,
    });
    expect(
      parseOAuthState(
        JSON.stringify({
          state: 'other-state',
          redirectUri: MOBILE_AUTH_REDIRECT_URI,
        }),
        'state-3',
      ),
    ).toEqual({ valid: false, redirectUri: null, deviceId: null });
    expect(
      parseOAuthState(
        JSON.stringify({
          state: 'state-3',
          redirectUri: 'https://attacker.example',
        }),
        'state-3',
      ),
    ).toEqual({ valid: false, redirectUri: null, deviceId: null });
  });
});
