import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import url from "node:url";

if (process.env.NODE_ENV == "TEST") {
  process.env.DATABASE_URL = ":memory:";
} else {
  process.env.DATABASE_URL ||= url
    .pathToFileURL("production.sqlite3")
    .toString();
}

const pathName =
  process.env.DATABASE_URL == ":memory:"
    ? ":memory:"
    : new URL(process.env.DATABASE_URL).pathname;
export const db = drizzle(new Database(pathName));
