import 'reflect-metadata';
import request from "supertest";
import express, { Express, Request, Response, NextFunction } from "express";

jest.mock('typeorm', () => {
  const actualTypeorm = jest.requireActual('typeorm');
  return {
    ...actualTypeorm,
    Entity: () => (target: any) => target,
    PrimaryGeneratedColumn: () => (target: any, key: string) => {},
    Column: () => (target: any, key: string) => {},
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue({}),
    }),
  };
});

jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

const app = require("./index").default;

describe("Express App", () => {
  let server: Express;

  beforeAll(() => {
    server = app;
  });

  afterAll(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it("should tart the server", async () => {
    const result = await request(server).get("/");

    expect(result.status).toBe(200);
    expect(JSON.parse(result.text)).toEqual({
      success: false,
      error: "Please don't call this URL again.",
      result: null,
    });
  });

  it("should return 404 error when the URL is not exists", async () => {
    const response = await request(server).get("/v1/wrong/url");

    expect(response.status).toBe(404);
  });

  it("should handle errors", async () => {
    const errorApp = express();
    errorApp.use((req: Request, res: Response, next: NextFunction) => {
      const error = new Error("Test error") as any;
      error.status = 400;
      next(error);
    });
    errorApp.use(
      (err: any, req: Request, res: Response, next: NextFunction) => {
        let errorStatus = err.status || 500;
        let errorMessage = err.message || "Something went wrong.";
        return res.status(errorStatus).json({
          success: false,
          status: errorStatus,
          message: errorMessage,
          stack: err.stack,
        });
      }
    );

    const response = await request(errorApp).get("/error");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      status: 400,
      message: "Test error",
      stack: expect.any(String),
    });
  });
});