import { UAParser } from 'ua-parser-js';
import { AuthRequestContext } from '../types/auth-request';

function safeFirst(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  return first || undefined;
}

const UNKNOWN = 'Unknown';

function buildDeviceName(
  os: string,
  osVersion: string | undefined,
  browser: string,
  deviceType: string,
  deviceVendor: string | undefined,
  deviceModel: string | undefined,
): string {
  const parts: string[] = [];

  const isGenericModel = deviceModel?.toLowerCase() === 'macintosh';

  if (deviceModel && !isGenericModel) {
    if (deviceVendor && deviceVendor !== 'Apple' && !deviceModel.startsWith(deviceVendor)) {
      parts.push(`${deviceVendor} ${deviceModel}`);
    } else {
      parts.push(deviceModel);
    }
  } else if (deviceType === 'Mobile') {
    if (os === 'iOS') {
      parts.push('iPhone');
    } else if (os !== UNKNOWN) {
      parts.push(`${os} Mobile`);
    }
  }

  if (parts.length === 0 && os !== UNKNOWN) {
    parts.push(osVersion ? `${os} ${osVersion}` : os);
  }

  if (browser !== UNKNOWN) {
    parts.push(browser);
  }

  return parts.join(' \u00b7 ') || UNKNOWN;
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
  if (!userAgent) {
    return {
      device_name: null,
      device_type: 'Desktop',
      browser: UNKNOWN,
      operating_system: UNKNOWN,
    };
  }

  const parsed = new UAParser(userAgent).getResult();

  const osName = parsed.os.name ?? UNKNOWN;
  const osVersion = parsed.os.version ?? undefined;
  const browserName = parsed.browser.name ?? UNKNOWN;
  const deviceType =
    parsed.device.type === 'mobile' || parsed.device.type === 'tablet'
      ? 'Mobile'
      : 'Desktop';

  return {
    device_name: buildDeviceName(
      osName,
      osVersion,
      browserName,
      deviceType,
      parsed.device.vendor ?? undefined,
      parsed.device.model ?? undefined,
    ),
    device_type: deviceType,
    browser: browserName,
    operating_system: osName,
  };
}
