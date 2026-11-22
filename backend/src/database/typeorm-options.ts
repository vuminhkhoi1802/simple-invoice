import { DataSourceOptions } from 'typeorm';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../users/user.entity';
import { InitialSchema1764000000000 } from './migrations/1764000000000-InitialSchema';

export interface DbEnv {
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
}

/**
 * Shared by the Nest app, the migration runner and the seed script so all three
 * always target the same schema. `synchronize` is off: migrations own the schema.
 */
export function buildDataSourceOptions(env: DbEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    entities: [User, Invoice, InvoiceItem],
    migrations: [InitialSchema1764000000000],
    migrationsTableName: 'migrations',
    synchronize: false,
  };
}
