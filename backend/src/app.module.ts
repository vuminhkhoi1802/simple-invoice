import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ClockModule } from './common/clock/clock.module';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions, DbEnv } from './database/typeorm-options';
import { HealthController } from './health/health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions({
          DB_HOST: config.getOrThrow('DB_HOST'),
          DB_PORT: config.getOrThrow('DB_PORT'),
          DB_USER: config.getOrThrow('DB_USER'),
          DB_PASSWORD: config.getOrThrow('DB_PASSWORD'),
          DB_NAME: config.getOrThrow('DB_NAME'),
          DB_SSL: config.getOrThrow('DB_SSL'),
        } satisfies DbEnv),
        // Apply pending migrations on boot so `docker compose up` works from an empty DB.
        migrationsRun: true,
      }),
    }),
    ClockModule,
    UsersModule,
    AuthModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
