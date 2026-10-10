import { createApp } from "../src/server/app.js";
import { loadConfig } from "../src/server/config.js";
import { openDatabase } from "../src/server/db.js";

// Vercel Function: every /api/* request is rewritten here (see vercel.json).
const config = loadConfig();
if (!config.databaseUrl || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
  throw new Error("DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on Vercel");
}
const sql = await openDatabase(config);

export default createApp({ sql, config });
