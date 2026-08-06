import 'reflect-metadata';
import { Environment, validate } from './env.validation';

describe('validate environment', () => {
  it('accepts a valid development configuration', () => {
    const config = validate({
      NODE_ENV: 'development',
      PORT: '3000',
      CORS_ORIGINS: 'http://localhost:3000',
    });

    expect(config.NODE_ENV).toBe(Environment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGINS).toBe('http://localhost:3000');
  });

  it('applies defaults when variables are missing', () => {
    const config = validate({});

    expect(config.NODE_ENV).toBe(Environment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
  });

  it('throws when NODE_ENV is invalid', () => {
    expect(() => validate({ NODE_ENV: 'invalid' })).toThrow(
      'Environment validation failed',
    );
  });

  it('throws when PORT is outside the valid range', () => {
    expect(() => validate({ PORT: '70000' })).toThrow(
      'Environment validation failed',
    );
  });
});
