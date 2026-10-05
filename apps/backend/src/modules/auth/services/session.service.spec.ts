import { SessionService } from './session.service';
import type { ISessionRepository } from '../repositories/session.repository.interface';
import type { IRefreshTokenRepository } from '../repositories/refresh-token.repository.interface';
import type { SessionEntity } from '../entities/session.entity';
import { PrismaSessionRepository } from '../repositories/prisma-session.repository';
import { PrismaRefreshTokenRepository } from '../repositories/prisma-refresh-token.repository';

const now = new Date();

describe('SessionService', () => {
  let repo: Partial<ISessionRepository>;
  let refreshRepo: Partial<IRefreshTokenRepository>;
  let svc: SessionService;

  beforeEach(() => {
    repo = {
      create: jest.fn((d: Partial<SessionEntity>) => {
        const dd = d;
        return Promise.resolve({
          ...(dd as unknown as Record<string, unknown>),
          id: dd.id ?? 'sid',
          user_id: dd.user_id ?? 'u1',
          refresh_token_id: dd.refresh_token_id ?? 'r1',
          created_at: now,
          updated_at: now,
        } as SessionEntity);
      }),
      findActiveByUserId: jest.fn(() => Promise.resolve([])),
      findById: jest.fn(() => Promise.resolve(null)),
      revoke: jest.fn(() => Promise.resolve()),
      revokeMany: jest.fn(() => Promise.resolve()),
      revokeAllExcept: jest.fn(() => Promise.resolve()),
      updateLastActivity: jest.fn(() => Promise.resolve()),
      updateRefreshToken: jest.fn(() => Promise.resolve()),
    };
    refreshRepo = {
      revoke: jest.fn(() => Promise.resolve()),
    };
    // PrismaSessionRepository expected; tests use a lightweight fake cast to the concrete type
    svc = new SessionService(
      repo as unknown as PrismaSessionRepository,
      refreshRepo as unknown as PrismaRefreshTokenRepository,
    );
  });

  it('creates a session', async () => {
    const s = await svc.create({
      id: 's1',
      user_id: 'u1',
      refresh_token_id: 'r1',
      last_activity_at: now,
      expires_at: new Date(now.getTime() + 1000 * 60 * 60),
    });
    expect((repo.create as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect(s.id).toBe('s1');
  });

  it('lists sessions for user', async () => {
    (repo.findActiveByUserId as jest.Mock).mockResolvedValue([
      {
        id: 'newer',
        user_id: 'u1',
        user_agent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36',
        last_activity_at: new Date('2026-04-02T00:00:00.000Z'),
      },
      {
        id: 'older',
        user_id: 'u1',
        user_agent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        last_activity_at: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
    const list = await svc.listForUser('u1');
    expect(repo.findActiveByUserId).toHaveBeenCalledWith('u1');
    expect(list.map((session) => session.id)).toEqual(['newer', 'older']);
    expect(list.map((session) => session.device_name)).toEqual([
      'Windows PC · Chrome',
      'Mac · Safari',
    ]);
  });

  it('revokes session only if owned', async () => {
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      refresh_token_id: 'r1',
    });
    await svc.revoke('s1', 'u1');
    expect(repo.revoke).toHaveBeenCalledWith('s1');
    expect(refreshRepo.revoke).toHaveBeenCalledWith('r1');
  });

  it('does not revoke session when not owner', async () => {
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 's1',
      user_id: 'u1',
      refresh_token_id: 'r1',
    });
    await svc.revoke('s1', 'other');
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('revokes all except current', async () => {
    (repo.findActiveByUserId as jest.Mock).mockResolvedValue([
      { id: 's1', refresh_token_id: 'r1' },
      { id: 's2', refresh_token_id: 'r2' },
    ]);
    await svc.revokeAllExcept('u1', 's1');
    expect(repo.revokeMany).toHaveBeenCalled();
    expect(refreshRepo.revoke).toHaveBeenCalled();
  });

  it('replaces only sessions registered to the same installation', async () => {
    (repo.findActiveByUserId as jest.Mock).mockResolvedValue([
      {
        id: 'same-device',
        refresh_token_id: 'old-refresh',
        device_id: 'device-a',
      },
      {
        id: 'other-device',
        refresh_token_id: 'other-refresh',
        device_id: 'device-b',
      },
    ]);

    await svc.revokeDeviceSessions('u1', 'device-a');

    expect(repo.revokeMany).toHaveBeenCalledWith(['same-device']);
    expect(refreshRepo.revoke).toHaveBeenCalledWith('old-refresh');
    expect(refreshRepo.revoke).not.toHaveBeenCalledWith('other-refresh');
  });

  it('logout current delegates to revoke', async () => {
    const spy = jest.spyOn(svc, 'revoke');
    await svc.logoutCurrent('s1', 'u1');
    expect(spy).toHaveBeenCalledWith('s1', 'u1');
  });
});
