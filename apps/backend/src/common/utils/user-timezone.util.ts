import type { PrismaService } from '../../database/prisma.service';

const FALLBACK_TIMEZONE = 'Asia/Jakarta';

export async function resolveUserTimezone(
  prisma: Pick<PrismaService, 'userSettings'>,
  userId: string,
): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { user_id: userId },
    select: { timezone: true },
  });
  const candidates = [
    settings?.timezone,
    process.env.APP_DEFAULT_TIMEZONE,
    FALLBACK_TIMEZONE,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate });
      return candidate;
    } catch {
      // Continue through the documented fallback order.
    }
  }

  return FALLBACK_TIMEZONE;
}
