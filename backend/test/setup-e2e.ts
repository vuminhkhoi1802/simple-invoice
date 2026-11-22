/**
 * E2E tests run against a real PostgreSQL database (default: simple_invoice_test on
 * localhost). Override with the usual DB_* variables, e.g. in CI.
 * The schema is dropped and re-migrated at the start of the run.
 */
process.env.NODE_ENV = 'test';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USER ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'simple_invoice_test';
process.env.JWT_SECRET ??= 'e2e-test-secret-that-is-at-least-32-chars';
process.env.JWT_EXPIRES_IN ??= '3600';
process.env.LOGIN_RATE_LIMIT = '1000';
