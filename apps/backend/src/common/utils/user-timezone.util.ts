import type { PrismaService } from '../../database/prisma.service';
import {
  canonicalIndonesianTimezone,
  isAllowedUserTimezone,
} from './indonesian-timezone';

const FALLBACK_TIMEZONE = 'Asia/Jakarta';

export function isValidUserTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export { isAllowedUserTimezone };

export async function resolveUserTimezone(
  prisma: Pick<PrismaService, 'userSettings'>,
  userId: string,
): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { user_id: userId },
    select: { timezone: true },
  });
  const candidates = [
    canonicalIndonesianTimezone(settings?.timezone) ?? settings?.timezone,
    process.env.APP_DEFAULT_TIMEZONE,
    FALLBACK_TIMEZONE,
  ];

  for (const candidate of candidates) {
    if (isValidUserTimezone(candidate)) return candidate;
  }

  return FALLBACK_TIMEZONE;
}
