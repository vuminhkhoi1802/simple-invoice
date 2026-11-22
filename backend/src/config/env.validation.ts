import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true' || value === '1';

/**
 * Schema for every environment variable the API reads.
 * The process fails fast on boot if any value is missing or malformed,
 * so misconfiguration never surfaces as a runtime 500.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DB_HOST: string;

  @IsInt()
  DB_PORT: number = 5432;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsBoolean()
  @Transform(toBool)
  DB_SSL: boolean = false;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET: string;

  /** Access-token lifetime in seconds. */
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN: number = 3600;

  /** Set true when served over HTTPS so the auth cookie gets the Secure flag. */
  @IsBoolean()
  @Transform(toBool)
  COOKIE_SECURE: boolean = false;

  /** Comma-separated list of allowed browser origins. Empty = same-origin only. */
  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  /** IANA timezone used to decide what "today" is for Overdue derivation. */
  @IsString()
  APP_TIMEZONE: string = 'UTC';

  @IsInt()
  @Min(1)
  LOGIN_RATE_LIMIT: number = 10;

  @IsInt()
  @Min(1)
  LOGIN_RATE_TTL_SECONDS: number = 60;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: validated.APP_TIMEZONE });
  } catch {
    throw new Error(`Invalid environment configuration: unknown APP_TIMEZONE "${validated.APP_TIMEZONE}"`);
  }
  return validated;
}
