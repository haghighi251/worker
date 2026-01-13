import 'reflect-metadata';
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import companyRouter  from "@/infrastructure/http/routes/company";
import { getAppDataSource } from '@/infrastructure/database/app-data-source';
import { setupLogging } from '@/infrastructure/logs/logging';
import { ROUTES } from '@/infrastructure/http/routes/routes';
import { setupProxies } from '@/infrastructure/shared/proxy';

const app = express();
dotenv.config();

// To log the incoming requests
setupLogging(app);
setupProxies(app, ROUTES);

const port = process.env.PORT || 8000;

export type RequestError = Error & { status: number };

app.use(cors());
app.use(express.json());

app.get("/", (_: Request, res: Response) => {
  res.send({
    success: false,
    error: "Please don't call this URL again.",
    result: null,
  });
});
app.use('/company', companyRouter);

app.use((error: RequestError, _: Request, res: Response, next: NextFunction) => {
  let errorStatus = error.status || 500;
  let errorMessage = error.message || "Something went wrong.";
  return res.status(errorStatus).json({
    success: false,
    error: errorMessage,
  });
});

getAppDataSource().initialize().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Server is running on http://localhost:${port}`);
    });
}).catch((error: unknown) => console.log('Error initializing data source', error));

export default app;