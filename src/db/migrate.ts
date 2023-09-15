import { db } from ".";
import { migrate as migrator } from "drizzle-orm/better-sqlite3/migrator";
export async function migrate() {
  await migrator(db, { migrationsFolder: "./src/db/migrations" });
}
