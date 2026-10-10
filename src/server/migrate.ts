import { loadConfig } from "./config.js";
import { migrateDatabase } from "./db.js";
import { createPostgresSql } from "./sql.js";

// Applies the schema to Supabase Postgres: DATABASE_URL=... npm run db:migrate
const config = loadConfig();
if (!config.databaseUrl) throw new Error("DATABASE_URL is required");
const sql = createPostgresSql(config.databaseUrl);
try {
  await migrateDatabase(sql);
  console.log("Schema is up to date");
} finally {
  await sql.close();
}
