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
  browser: string,
  deviceType: string,
  deviceVendor: string | undefined,
  deviceModel: string | undefined,
): string {
  const isGenericModel = deviceModel?.toLowerCase() === 'macintosh';

  if (
    (deviceType === 'Mobile' || deviceType === 'Tablet') &&
    deviceModel &&
    !isGenericModel
  ) {
    const parts: string[] = [];
    if (
      deviceVendor &&
      deviceVendor !== 'Apple' &&
      !deviceModel.startsWith(deviceVendor)
    ) {
      parts.push(`${deviceVendor} ${deviceModel}`);
    } else {
      parts.push(deviceModel);
    }
    return parts.join(' \u00b7 ');
  }

  if (deviceType === 'Mobile' || deviceType === 'Tablet') {
    if (os === 'iOS' || os === 'iPadOS') {
      return deviceType === 'Tablet' ? 'iPad' : 'iPhone';
    }
    if (os === 'Android') {
      return deviceType === 'Tablet' ? 'Android tablet' : 'Android';
    }
    return os === UNKNOWN ? UNKNOWN : os;
  }

  const normalizedOs = os.toLowerCase();
  const deviceLabel = normalizedOs.startsWith('windows')
    ? 'Windows PC'
    : normalizedOs.startsWith('mac')
      ? 'Mac'
      : os === UNKNOWN
        ? null
        : `${os} PC`;
  const normalizedBrowser = browser.replace(/^Mobile\s+/i, '');
  const parts = [
    deviceLabel,
    browser === UNKNOWN ? null : normalizedBrowser,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(' \u00b7 ');
  }

  return UNKNOWN;
}

export function extractAuthRequestContext(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): AuthRequestContext {
  const header = (name: string): string | undefined => {
    const v = req.headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const ip =
    safeFirst(header('x-forwarded-for') ?? '') ??
    safeFirst(header('x-real-ip') ?? '') ??
    safeFirst(req.ip ?? '');
  const userAgent = header('user-agent');
  const firstHeader = (...names: string[]): string | undefined => {
    for (const name of names) {
      const value = safeFirst(header(name) ?? '');
      if (value) return value;
    }
    return undefined;
  };
  const city = firstHeader('cf-ipcity', 'x-vercel-ip-city');
  const country = firstHeader('cf-ipcountry', 'x-vercel-ip-country');
  const deviceId = firstHeader('x-device-id');
  const clientPlatform = firstHeader('x-client-platform')?.toLowerCase();
  return {
    ip: ip ? ip.replace(/"/g, '') : null,
    userAgent: userAgent ?? null,
    city: city ? decodeURIComponent(city).replace(/"/g, '') : null,
    country: country ? country.replace(/"/g, '') : null,
    deviceId:
      deviceId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        deviceId,
      )
        ? deviceId.toLowerCase()
        : null,
    clientPlatform:
      clientPlatform === 'android' || clientPlatform === 'ios'
        ? clientPlatform
        : null,
  };
}

export function deriveDeviceInfo(
  userAgent: string | null,
  clientPlatform?: AuthRequestContext['clientPlatform'],
) {
  if (!userAgent && !clientPlatform) {
    return {
      device_name: null,
      device_type: 'Desktop',
      browser: UNKNOWN,
      operating_system: UNKNOWN,
    };
  }

  const parsed = new UAParser(userAgent ?? '').getResult();

  const osName = clientPlatform
    ? clientPlatform === 'ios'
      ? 'iOS'
      : 'Android'
    : (parsed.os.name ?? UNKNOWN);
  const browserName = clientPlatform
    ? UNKNOWN
    : (parsed.browser.name ?? UNKNOWN);
  const deviceType = clientPlatform
    ? 'Mobile'
    : parsed.device.type === 'tablet'
      ? 'Tablet'
      : parsed.device.type === 'mobile'
        ? 'Mobile'
        : 'Desktop';

  return {
    device_name: buildDeviceName(
      osName,
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
