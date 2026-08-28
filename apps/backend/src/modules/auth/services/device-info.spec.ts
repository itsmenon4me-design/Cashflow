import {
  deriveDeviceInfo,
  extractAuthRequestContext,
} from './device-info';

describe('device-info parser', () => {
  it('extracts request context properly', () => {
    const ctx = extractAuthRequestContext({
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'x-forwarded-for': '127.0.0.1, 10.0.0.1',
        'cf-ipcity': 'Jakarta',
        'cf-ipcountry': 'ID',
      },
    });

    expect(ctx.ip).toBe('127.0.0.1');
    expect(ctx.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(ctx.city).toBe('Jakarta');
    expect(ctx.country).toBe('ID');
  });

  it('detects Windows Chrome desktop device', () => {
    const info = deriveDeviceInfo(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    );
    expect(info.device_type).toBe('Desktop');
    expect(info.operating_system).toBe('Windows');
    expect(info.browser).toBe('Chrome');
    expect(info.device_name).toBe('Windows 10 · Chrome');
  });

  it('detects macOS Safari desktop device', () => {
    const info = deriveDeviceInfo(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(info.device_type).toBe('Desktop');
    expect(info.operating_system).toBe('macOS');
    expect(info.browser).toBe('Safari');
    expect(info.device_name).toBe('macOS 10.15.7 · Safari');
  });

  it('detects iPhone iOS mobile device', () => {
    const info = deriveDeviceInfo(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(info.device_type).toBe('Mobile');
    expect(info.operating_system).toBe('iOS');
    expect(info.browser).toBe('Mobile Safari');
    expect(info.device_name).toBe('iPhone · Mobile Safari');
  });

  it('detects Android Chrome mobile device with vendor/model', () => {
    const info = deriveDeviceInfo(
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    );
    expect(info.device_type).toBe('Mobile');
    expect(info.operating_system).toBe('Android');
    expect(info.browser).toBe('Mobile Chrome');
    expect(info.device_name).toBe('Samsung SM-S918B · Mobile Chrome');
  });

  it('handles null/empty UA gracefully', () => {
    const info = deriveDeviceInfo(null);
    expect(info.device_name).toBeNull();
    expect(info.device_type).toBe('Desktop');
    expect(info.browser).toBe('Unknown');
    expect(info.operating_system).toBe('Unknown');
  });
});
