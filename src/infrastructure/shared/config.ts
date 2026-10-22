import { z } from 'zod';

// Define schema for ONLY specified variables
const envSchema = z.object({
  
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  DB_TYPE: z.string().default('postgres'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('aba'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/aba'),
  JWT_SECRET: z.string().default('+!exTxt#cBqz/V!11YS!0X:*(5s&ZcP,GSKKeXXwjB%~B!u@;45`5Qi0xTB~^`r]'),
  MONGODB_URL: z.string().default('mongodb://localhost:27017/aba'),
  BFF_URL: z.string().default('http://localhost:3002'),
  ENCRYPTION_KEY: z.string().default('THE_VALUE_OF_ENCRYPTION_KEY_GOES_HERE'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  // Same variable names as aba-bl's MailerModule config, so both services
  // read the same .env values — worker only sends the vulnerability digest,
  // aba-bl still owns other transactional email (password reset, etc).
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  // How often the digest sweep's cron tick fires — NOT how often a given
  // service actually gets re-notified (that's governed by
  // NOTIFICATION_DIGEST_INTERVAL_HOURS below plus the sweep's own claim
  // guard). Default: once a day at 08:00.
  NOTIFICATION_DIGEST_CRON: z.string().default('0 8 * * *'),
  // Minimum time between two digest emails for the same package, applied by
  // the sweep after a successful send (rolling from lastNotifiedAt).
  NOTIFICATION_DIGEST_INTERVAL_HOURS: z.coerce.number().default(24),
  // Shared-secret header required by the internal "run sweep now" endpoint.
  // Empty in dev/test (that endpoint then allows any caller); must be set
  // in production.
  INTERNAL_API_KEY: z.string().default(''),
});

// Parse and validate
const env = envSchema.parse(process.env);

// Create config object with EXACTLY your variable names
export const config = {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  DB_TYPE: env.DB_TYPE,
  DB_HOST: env.DB_HOST,
  DB_PORT: env.DB_PORT,
  DB_USERNAME: env.DB_USERNAME,
  DB_PASSWORD: env.DB_PASSWORD,
  DB_NAME: env.DB_NAME,
  DATABASE_URL: env.DATABASE_URL,
  JWT_SECRET: env.JWT_SECRET,
  MONGODB_URL: env.MONGODB_URL,
  BFF_URL: env.BFF_URL,
  ENCRYPTION_KEY: env.ENCRYPTION_KEY,
  KAFKA_BROKERS: env.KAFKA_BROKERS,
  SMTP_HOST: env.SMTP_HOST,
  SMTP_PORT: env.SMTP_PORT,
  SMTP_USER: env.SMTP_USER,
  SMTP_PASS: env.SMTP_PASS,
  NOTIFICATION_DIGEST_CRON: env.NOTIFICATION_DIGEST_CRON,
  NOTIFICATION_DIGEST_INTERVAL_HOURS: env.NOTIFICATION_DIGEST_INTERVAL_HOURS,
  INTERNAL_API_KEY: env.INTERNAL_API_KEY,
};

// TypeScript type
export type TConfig = typeof config;