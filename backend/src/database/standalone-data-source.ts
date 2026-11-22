import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation';
import { buildDataSourceOptions } from './typeorm-options';

/** DataSource for CLI scripts (migrations, seeding) that run outside the Nest container. */
export function createStandaloneDataSource(): DataSource {
  dotenv.config();
  const env = validateEnv(process.env);
  return new DataSource(buildDataSourceOptions(env));
}
