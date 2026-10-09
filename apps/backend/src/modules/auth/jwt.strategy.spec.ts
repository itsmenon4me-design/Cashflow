import { JwtStrategy } from './jwt.strategy';
import { JwtConfigService } from '../../config/jwt-config.service';
import { SessionService } from './services/session.service';

describe('JwtStrategy.validate', () => {
  const mockCfg = { config: { secret: 's' } } as unknown as JwtConfigService;
  const isAccessSessionActive = jest.fn();
  const sessions = {
    isAccessSessionActive,
  } as unknown as SessionService;
  const strat = new JwtStrategy(mockCfg, sessions);

  beforeEach(() => {
    jest.clearAllMocks();
    (sessions.isAccessSessionActive as jest.Mock).mockResolvedValue(true);
  });

  it('throws on missing sub', async () => {
    await expect(strat.validate({})).rejects.toThrow();
  });

  it('rejects missing or revoked sessions', async () => {
    await expect(strat.validate({ sub: 'u1' })).rejects.toThrow();
    (sessions.isAccessSessionActive as jest.Mock).mockResolvedValue(false);
    await expect(
      strat.validate({ sub: 'u1', sessionId: 'revoked' }),
    ).rejects.toThrow();
    expect(isAccessSessionActive).toHaveBeenCalledWith('revoked', 'u1');
  });

  it('returns sanitized AuthUser and excludes unexpected claims', async () => {
    const payload: Record<string, unknown> = {
      sub: 'u1',
      jti: 'j1',
      sessionId: 's1',
      role: 'USER',
      email: 'user@example.com',
      unexpected: 'x',
    };
    const out = await strat.validate(payload);
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

  it('requires a session claim for revocable authentication', async () => {
    await expect(strat.validate({ sub: 'u2' })).rejects.toThrow();
  });
});
