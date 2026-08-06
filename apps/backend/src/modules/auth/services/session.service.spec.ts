import { SessionService } from './session.service';
import type { ISessionRepository } from '../repositories/session.repository.interface';
import type { IRefreshTokenRepository } from '../repositories/refresh-token.repository.interface';
import type { SessionEntity } from '../entities/session.entity';

const now = new Date();

describe('SessionService', () => {
  let repo: Partial<ISessionRepository>;
  let refreshRepo: Partial<IRefreshTokenRepository>;
  let svc: SessionService;

  beforeEach(() => {
    repo = {
      create: jest.fn((d: Partial<SessionEntity>) =>
        Promise.resolve({
          ...d,
          id: d.id ?? 'sid',
          created_at: now,
          updated_at: now,
        }),
      ),
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
    svc = new SessionService(
      repo as ISessionRepository,
      refreshRepo as IRefreshTokenRepository,
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
      { id: 's1', user_id: 'u1' },
    ]);
    const list = await svc.listForUser('u1');
    expect(repo.findActiveByUserId).toHaveBeenCalledWith('u1');
    expect(list).toHaveLength(1);
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

  it('logout current delegates to revoke', async () => {
    const spy = jest.spyOn(svc, 'revoke');
    await svc.logoutCurrent('s1', 'u1');
    expect(spy).toHaveBeenCalledWith('s1', 'u1');
  });
});
