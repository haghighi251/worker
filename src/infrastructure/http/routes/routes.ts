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
        url: '/company/new',
        auth: false,
        creditCheck: false,
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 5
        },
        proxy: {
            target: "https://www.google.com",
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