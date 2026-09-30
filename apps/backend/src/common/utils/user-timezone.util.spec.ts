import { resolveUserTimezone } from './user-timezone.util';
import type { PrismaService } from '../../database/prisma.service';

describe('resolveUserTimezone', () => {
  const previousDefault = process.env.APP_DEFAULT_TIMEZONE;

  afterEach(() => {
    if (previousDefault === undefined) {
      delete process.env.APP_DEFAULT_TIMEZONE;
    } else {
      process.env.APP_DEFAULT_TIMEZONE = previousDefault;
    }
  });

  it('prefers a valid user setting over the application default', async () => {
    process.env.APP_DEFAULT_TIMEZONE = 'Asia/Jakarta';
    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Makassar' }),
      },
    };

    await expect(
      resolveUserTimezone(
        prisma as unknown as Pick<PrismaService, 'userSettings'>,
        'user-1',
      ),
    ).resolves.toBe('Asia/Makassar');
  });

  it.each([
    ['Asia/Pontianak', 'Asia/Jakarta'],
    ['Asia/Ujung_Pandang', 'Asia/Makassar'],
  ])('canonicalizes the stored Indonesian alias %s', async (stored, resolved) => {
    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: stored }),
      },
    };

    await expect(
      resolveUserTimezone(
        prisma as unknown as Pick<PrismaService, 'userSettings'>,
        'user-1',
      ),
    ).resolves.toBe(resolved);
  });

  it('uses the application timezone when the user setting is invalid', async () => {
    process.env.APP_DEFAULT_TIMEZONE = 'Asia/Jayapura';
    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Not/AZone' }),
      },
    };

    await expect(
      resolveUserTimezone(
        prisma as unknown as Pick<PrismaService, 'userSettings'>,
        'user-1',
      ),
    ).resolves.toBe('Asia/Jayapura');
  });

  it('falls back to WIB when all configured zones are invalid or absent', async () => {
    process.env.APP_DEFAULT_TIMEZONE = 'Not/AZone';
    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: null }),
      },
    };

    await expect(
      resolveUserTimezone(
        prisma as unknown as Pick<PrismaService, 'userSettings'>,
        'user-1',
      ),
    ).resolves.toBe('Asia/Jakarta');
  });
});
