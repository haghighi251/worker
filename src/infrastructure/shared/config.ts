import { z } from 'zod';

// Define schema for ONLY specified variables
const envSchema = z.object({
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
});

// Parse and validate
const env = envSchema.parse(process.env);

// Create config object with EXACTLY your variable names
export const config = {
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
};

// TypeScript type
export type TConfig = typeof config;