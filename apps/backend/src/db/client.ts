import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const dbPath = process.env.SKY_DB_PATH ?? "../../var/sky.db";
const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite);
export type Db = typeof db;