import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const databasePath = process.env.DATABASE_PATH;
if (!databasePath?.trim()) {
  throw new Error("Set DATABASE_PATH in .env or your environment.");
}

export default defineConfig({
  // Uses local SQLite database file for development, and Turso for production.
  dialect: "sqlite",
  schema: "./src/db/tables.ts",
  dbCredentials: {
    url: pathToFileURL(resolve(databasePath)).href,
  },
});
