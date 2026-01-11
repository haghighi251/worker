import { DataSource } from "typeorm";
import { ExampleData } from "@infrastructure/database/entities/example";

const db_port: number = Number(process.env.DB_PORT) || 5432;
let dataSource: DataSource | null = null;

export function getAppDataSource(): DataSource {
  if (!dataSource) {
    dataSource = new DataSource({
      type: "postgres",
      host: process.env.DB_HOST || "postgres",
      port: db_port || 5432,
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "aba",
      synchronize: true,
      entities: [ExampleData],
      connectTimeoutMS: 30000,
    });
  }
  return dataSource;
}