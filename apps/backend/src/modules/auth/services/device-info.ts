import { AuthRequestContext } from '../types/auth-request';

function safeFirst(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  return first || undefined;
}

const UNKNOWN = 'Unknown';

function detectBrowser(ua: string | null): string {
  if (!ua) return UNKNOWN;
  const s = ua.toLowerCase();
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('opr/') || s.includes('opera')) return 'Opera';
  if (s.includes('chrome/') && s.includes('chromium')) return 'Chromium';
  if (s.includes('chrome/')) return 'Chrome';
  if (s.includes('firefox/')) return 'Firefox';
  if (s.includes('safari/') && !s.includes('chrome')) return 'Safari';
  return UNKNOWN;
}

function detectOS(ua: string | null): string {
  if (!ua) return UNKNOWN;
  const s = ua.toLowerCase();
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod') || s.includes('ios')) return 'iOS';
  if (s.includes('android')) return 'Android';
  if (s.includes('win')) return 'Windows';
  if (s.includes('mac os') || s.includes('macintosh') || s.includes('macos')) return 'macOS';
  if (s.includes('linux') || s.includes('cros')) return 'Linux';
  return UNKNOWN;
}

function detectDeviceType(ua: string | null): string {
  if (!ua) return 'Desktop';
  return /mobile|android|iphone|ipad|ipod|blackberry|iemobile/.test(
    ua.toLowerCase(),
  )
    ? 'Mobile'
    : 'Desktop';
}

function detectDeviceName(ua: string | null): string | null {
  if (!ua) return null;
  const type = detectDeviceType(ua);
  const os = detectOS(ua);
  return type === 'Mobile' ? `${os} Mobile` : `${os} Browser`;
}

export function extractAuthRequestContext(req: {
  headers: Record<string, string | string[] | undefined>;
}): AuthRequestContext {
  const header = (name: string): string | undefined => {
    const v = req.headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const ip = safeFirst(header('x-forwarded-for') ?? '') ?? header('x-real-ip');
  const userAgent = header('user-agent');
  const city = header('cf-ipcity') ?? header('x-vercel-ip-city');
  const country = header('cf-ipcountry') || header('x-vercel-ip-country');
  return {
    ip: ip ? ip.replace(/"/g, '') : null,
    userAgent: userAgent ?? null,
    city: city ? decodeURIComponent(city).replace(/"/g, '') : null,
    country: country ? country.replace(/"/g, '') : null,
  };
}

export function deriveDeviceInfo(userAgent: string | null) {
  return {
    device_name: detectDeviceName(userAgent),
    device_type: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    operating_system: detectOS(userAgent),
  };
}
