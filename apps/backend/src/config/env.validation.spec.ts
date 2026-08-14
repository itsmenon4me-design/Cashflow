import 'reflect-metadata';
import { Environment, JWT_SECRET_MIN_LENGTH, validate } from './env.validation';

const VALID_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/cashflow?schema=public';
const VALID_JWT_SECRET = 'a'.repeat(96);
const VALID_JWT_REFRESH_SECRET = 'b'.repeat(96);

function validEnv(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: VALID_DATABASE_URL,
    JWT_SECRET: VALID_JWT_SECRET,
    JWT_REFRESH_SECRET: VALID_JWT_REFRESH_SECRET,
    ...overrides,
  };
}

describe('validate environment', () => {
  it('accepts a valid development configuration', () => {
    const config = validate(
      validEnv({
        PORT: '3000',
        CORS_ORIGINS: 'http://localhost:3000',
      }),
    );

    expect(config.NODE_ENV).toBe(Environment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGINS).toBe('http://localhost:3000');
    expect(config.DATABASE_URL).toBe(VALID_DATABASE_URL);
    expect(config.JWT_SECRET).toBe(VALID_JWT_SECRET);
    expect(config.JWT_REFRESH_SECRET).toBe(VALID_JWT_REFRESH_SECRET);
  });

  it('applies defaults for optional variables when required variables are provided', () => {
    const config = validate(validEnv());

    expect(config.NODE_ENV).toBe(Environment.Development);
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
  });

  it('throws when NODE_ENV is invalid', () => {
    expect(() => validate(validEnv({ NODE_ENV: 'invalid' }))).toThrow(
      'Environment validation failed',
    );
  });

  it('throws when PORT is outside the valid range', () => {
    expect(() => validate(validEnv({ PORT: '70000' }))).toThrow(
      'Environment validation failed',
    );
  });

  describe('JWT_SECRET', () => {
    it('rejects a missing JWT_SECRET', () => {
      const env = validEnv();
      delete env.JWT_SECRET;

      expect(() => validate(env)).toThrow('Environment validation failed');
    });

    it('rejects an empty JWT_SECRET', () => {
      expect(() => validate(validEnv({ JWT_SECRET: '' }))).toThrow(
        'JWT_SECRET must not be empty',
      );
    });

    it('rejects a whitespace-only JWT_SECRET', () => {
      expect(() => validate(validEnv({ JWT_SECRET: '   ' }))).toThrow(
        'JWT_SECRET must not be whitespace only',
      );
    });

    it('rejects a JWT_SECRET below the minimum length', () => {
      const shortSecret = 'x'.repeat(JWT_SECRET_MIN_LENGTH - 1);

      expect(() => validate(validEnv({ JWT_SECRET: shortSecret }))).toThrow(
        `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`,
      );
    });

    it('accepts a valid JWT_SECRET', () => {
      const config = validate(validEnv({ JWT_SECRET: VALID_JWT_SECRET }));

      expect(config.JWT_SECRET).toBe(VALID_JWT_SECRET);
    });

    it('does not expose the attempted JWT_SECRET value in validation errors', () => {
      const attemptedSecret = 'x'.repeat(JWT_SECRET_MIN_LENGTH - 1);
      let message = '';

      try {
        validate(validEnv({ JWT_SECRET: attemptedSecret }));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('JWT_SECRET');
      expect(message).not.toContain(attemptedSecret);
    });
  });

  describe('JWT_REFRESH_SECRET', () => {
    it('rejects a missing JWT_REFRESH_SECRET', () => {
      const env = validEnv();
      delete env.JWT_REFRESH_SECRET;

      expect(() => validate(env)).toThrow('Environment validation failed');
    });

    it('rejects an empty JWT_REFRESH_SECRET', () => {
      expect(() => validate(validEnv({ JWT_REFRESH_SECRET: '' }))).toThrow(
        'JWT_REFRESH_SECRET must not be empty',
      );
    });

    it('rejects a whitespace-only JWT_REFRESH_SECRET', () => {
      expect(() => validate(validEnv({ JWT_REFRESH_SECRET: '   ' }))).toThrow(
        'JWT_REFRESH_SECRET must not be whitespace only',
      );
    });

    it('rejects a JWT_REFRESH_SECRET below the minimum length', () => {
      const shortSecret = 'y'.repeat(JWT_SECRET_MIN_LENGTH - 1);

      expect(() =>
        validate(validEnv({ JWT_REFRESH_SECRET: shortSecret })),
      ).toThrow(
        `JWT_REFRESH_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`,
      );
    });

    it('accepts a valid JWT_REFRESH_SECRET', () => {
      const config = validate(
        validEnv({ JWT_REFRESH_SECRET: VALID_JWT_REFRESH_SECRET }),
      );

      expect(config.JWT_REFRESH_SECRET).toBe(VALID_JWT_REFRESH_SECRET);
    });

    it('does not expose the attempted JWT_REFRESH_SECRET value in validation errors', () => {
      const attemptedSecret = 'y'.repeat(JWT_SECRET_MIN_LENGTH - 1);
      let message = '';

      try {
        validate(validEnv({ JWT_REFRESH_SECRET: attemptedSecret }));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('JWT_REFRESH_SECRET');
      expect(message).not.toContain(attemptedSecret);
    });
  });

  describe('DATABASE_URL', () => {
    it('rejects a missing DATABASE_URL', () => {
      const env = validEnv();
      delete env.DATABASE_URL;

      expect(() => validate(env)).toThrow('Environment validation failed');
    });

    it('rejects an empty DATABASE_URL', () => {
      expect(() => validate(validEnv({ DATABASE_URL: '' }))).toThrow(
        'DATABASE_URL must not be empty',
      );
    });

    it('rejects a whitespace-only DATABASE_URL', () => {
      expect(() => validate(validEnv({ DATABASE_URL: '   ' }))).toThrow(
        'DATABASE_URL must not be whitespace only',
      );
    });

    it('accepts a valid PostgreSQL DATABASE_URL', () => {
      const config = validate(validEnv({ DATABASE_URL: VALID_DATABASE_URL }));

      expect(config.DATABASE_URL).toBe(VALID_DATABASE_URL);
    });
  });
});
