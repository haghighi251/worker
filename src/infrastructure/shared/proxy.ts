import { Express } from 'express';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import { ProxyRoute } from '@infrastructure/http/routes/routes';

export const setupProxies = (app: Express, routes: ProxyRoute[]) => {
    routes.forEach((r: ProxyRoute) => {
        app.use(r.url, createProxyMiddleware(r.proxy));
    })
}