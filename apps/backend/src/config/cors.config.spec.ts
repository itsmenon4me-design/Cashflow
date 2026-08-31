import { corsConfig } from './cors.config';

const ORIGINAL: Record<string, string | undefined> = {
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('corsConfig', () => {
  it('disables CORS (empty origins) when nothing is configured in test mode', async () => {
    delete process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = 'test';
    expect((await corsConfig()).origin).toEqual([]);
  });

  it('uses local development origins when running without env config in development mode', async () => {
    delete process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = 'development';
    expect((await corsConfig()).origin).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3002',
    ]);
  });

  it('allows a single configured origin', async () => {
    process.env.CORS_ORIGINS = 'http://localhost';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    expect((await corsConfig()).origin).toEqual(['http://localhost']);
  });

  it('allows multiple configured origins', async () => {
    process.env.CORS_ORIGINS =
      'http://localhost, http://localhost:3000 ,http://localhost:3001';
    expect((await corsConfig()).origin).toEqual([
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  it('prefers CORS_ORIGINS over legacy CORS_ORIGIN', async () => {
    process.env.CORS_ORIGINS = 'http://localhost';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    expect((await corsConfig()).origin).toEqual(['http://localhost']);
  });

  it('falls back to legacy CORS_ORIGIN when CORS_ORIGINS is unset', async () => {
    delete process.env.CORS_ORIGINS;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    expect((await corsConfig()).origin).toEqual(['http://localhost:3000']);
  });

  it('rejects the wildcard', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = '*';
    expect((await corsConfig()).origin).toEqual([]);
    process.env.CORS_ORIGINS = 'http://localhost, *';
    expect((await corsConfig()).origin).not.toContain('*');
    expect((await corsConfig()).origin).toEqual(['http://localhost']);
  });

  it('filters empty and whitespace entries', async () => {
    process.env.CORS_ORIGINS = 'http://localhost, ,   ';
    expect((await corsConfig()).origin).toEqual(['http://localhost']);
  });
});
