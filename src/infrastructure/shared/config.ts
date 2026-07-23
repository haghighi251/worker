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
};

// TypeScript type
export type TConfig = typeof config;