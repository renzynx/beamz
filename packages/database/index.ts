import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database("../../data/sqlite.db");

sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA busy_timeout = 5000;");

export const db = drizzle(sqlite, {
	schema,
});

export * from "./schema";
export { schema };
export * from "drizzle-orm";
