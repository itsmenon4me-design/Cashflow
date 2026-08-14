import { JwtStrategy } from './jwt.strategy';
import { JwtConfigService } from '../../config/jwt-config.service';

describe('JwtStrategy.validate', () => {
  const mockCfg = { config: { secret: 's' } } as unknown as JwtConfigService;
  const strat = new JwtStrategy(mockCfg);

  it('throws on missing sub', () => {
    expect(() => strat.validate({})).toThrow();
  });

  it('returns sanitized AuthUser and excludes unexpected claims', () => {
    const payload: Record<string, unknown> = {
      sub: 'u1',
      jti: 'j1',
      sessionId: 's1',
      role: 'USER',
      email: 'user@example.com',
      unexpected: 'x',
    };
    const out = strat.validate(payload);
    expect(out).toEqual({
      sub: 'u1',
      jti: 'j1',
      sessionId: 's1',
      role: 'USER',
      email: 'user@example.com',
    });
    expect(
      (out as unknown as { unexpected?: unknown }).unexpected,
    ).toBeUndefined();
  });

  it('allows optional claims to be undefined', () => {
    const payload = { sub: 'u2' };
    const out = strat.validate(payload);
    expect(out.sub).toBe('u2');
    expect(out.jti).toBeUndefined();
    expect(out.sessionId).toBeUndefined();
    expect(out.role).toBeUndefined();
    expect(out.email).toBeUndefined();
  });
});
