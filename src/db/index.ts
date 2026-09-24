import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

// Opens a connection. Apply tables separately with npm run db:push.
export async function openDatabase(databasePath: string) {
  if (!databasePath.trim()) {
    throw new Error("A database file path is required.");
  }
  const client = new DatabaseSync(resolve(databasePath));

  try {
    client.exec("PRAGMA foreign_keys = ON");
    return {
      db: drizzle({ client }),
      close: () => client.close(),
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
