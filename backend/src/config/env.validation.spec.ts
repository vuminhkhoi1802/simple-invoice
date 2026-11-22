import { validateEnv } from './env.validation';

const base = {
  DB_HOST: 'localhost',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults, including a 3600s token lifetime', () => {
    const env = validateEnv(base);
    expect(env.JWT_EXPIRES_IN).toBe(3600);
    expect(env.PORT).toBe(3000);
    expect(env.APP_TIMEZONE).toBe('UTC');
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('coerces string values from process.env', () => {
    const env = validateEnv({ ...base, JWT_EXPIRES_IN: '900', COOKIE_SECURE: 'true' });
    expect(env.JWT_EXPIRES_IN).toBe(900);
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('rejects a missing or weak JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('rejects an unknown timezone', () => {
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
  });
});
