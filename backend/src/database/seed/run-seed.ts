import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createStandaloneDataSource } from '../standalone-data-source';
import { seedDatabase } from './seeder';

/** `npm run seed`: applies pending migrations, then seeds. Safe to re-run. */
async function main() {
  dotenv.config();
  const logger = new Logger('Seed');
  const { SEED_USER_EMAIL, SEED_USER_PASSWORD, SEED_USER_FULLNAME, APP_TIMEZONE } = process.env;

  const ds = await createStandaloneDataSource().initialize();
  try {
    if (!SEED_USER_EMAIL || !SEED_USER_PASSWORD) {
      throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.example)');
    }
    await ds.runMigrations({ transaction: 'each' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE || 'UTC' }).format(new Date());
    const result = await seedDatabase(
      ds,
      { email: SEED_USER_EMAIL, password: SEED_USER_PASSWORD, fullname: SEED_USER_FULLNAME || 'Demo Admin' },
      today,
    );
    logger.log(
      `User ${SEED_USER_EMAIL} ready. Invoices inserted: ${result.inserted}, already present: ${result.skipped}`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
