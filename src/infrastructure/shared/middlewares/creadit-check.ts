import { Request } from "express";
import type { Express } from "express";
import { ProxyRoute } from "@/infrastructure/http/routes/routes";

const checkCredit = (req: Request) => {
    return new Promise((resolve, reject) => {
        console.log("Checking credit with token", req.headers["authorization"]);
        setTimeout(() => {
            reject('No sufficient credits');
        }, 500);
    })
}

export const setupCreditCheck = (app: Express, routes: ProxyRoute[]) => {
    routes.forEach(r => {
        if (r.creditCheck) {
            app.use(r.url, function(req, res, next) {
                checkCredit(req).then(() => {
                    next();
                }).catch((error) => {
                    res.status(402).send({error});
                })
            });
        }
    })
}