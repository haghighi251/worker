import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { ProxyRoute } from "@/infrastructure/http/routes/routes";

export const setupRateLimit = (app: Express, routes: ProxyRoute[]) => {
    routes.forEach(r => {
        if (r.rateLimit) {
            app.use(r.url, rateLimit(r.rateLimit));
        }
    })
}