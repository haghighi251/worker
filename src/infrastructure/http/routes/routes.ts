import { config } from "@/infrastructure/shared/config";
import { Options } from "http-proxy-middleware";

export interface ProxyRoute {
  url: string;
  auth?: boolean;
  creditCheck?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  proxy: Options;
}

export const ROUTES: ProxyRoute[] = [
    {
        url: '/auth/login',
        auth: false,
        creditCheck: false,
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 10,
        },
        proxy: {
            target: config.BFF_URL,
            changeOrigin: true,
        },
    },
    {
        url: '/auth',
        auth: false,
        creditCheck: false,
        proxy: {
            target: config.BFF_URL,
            changeOrigin: true,
        },
    },
    {
        url: '/admin',
        auth: true,
        creditCheck: false,
        proxy: {
            target: config.BFF_URL,
            changeOrigin: true,
        },
    },
    {
        // All company management routes (GET/PUT company, user CRUD) — auth required
        // Must come BEFORE /company/new so Express matches the more specific path first
        url: '/company',
        auth: true,
        creditCheck: false,
        proxy: {
            target: config.BFF_URL,
            changeOrigin: true,
        },
    },
    {
        url: '/company/new',
        auth: false,
        creditCheck: false,
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 5
        },
        proxy: {
            target: config.BFF_URL,
            changeOrigin: true,
            pathRewrite: {
                [`^/company/new`]: '',
            },
        }
    },
    {
        url: '/premium',
        auth: true,
        creditCheck: true,
        proxy: {
            target: "https://www.google.com",
            changeOrigin: true,
            pathRewrite: {
                [`^/premium`]: '',
            },
        }
    }
];