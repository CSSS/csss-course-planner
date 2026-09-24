import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./tables.ts";

// Opens a connection. Apply tables separately with npm run db:push.
export async function openDatabase(databasePath: string) {
  if (!databasePath.trim()) {
    throw new Error("A database file path is required.");
  }
  const client = createClient({
    url: pathToFileURL(resolve(databasePath)).href,
  });

  try {
    await client.execute("PRAGMA foreign_keys = ON");
    return {
      db: drizzle(client, { schema }),
      close: () => client.close(),
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
