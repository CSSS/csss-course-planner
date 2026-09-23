import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./tables.ts";

// Opens a database connection and initializes the schema if necessary.
export async function openDatabase(databasePath: string) {
  if (!databasePath.trim()) {
    throw new Error("A database file path is required.");
  }

  const initializationSql = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  const client = createClient({
    url: pathToFileURL(resolve(databasePath)).href,
  });

  try {
    await client.executeMultiple(initializationSql);
    return {
      db: drizzle(client, { schema }),
      close: () => client.close(),
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
