import { Logger } from '@nestjs/common';
import { createStandaloneDataSource } from './standalone-data-source';

async function main() {
  const logger = new Logger('Migrations');
  const ds = await createStandaloneDataSource().initialize();
  try {
    const applied = await ds.runMigrations({ transaction: 'each' });
    logger.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Schema up to date');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
