import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";

// Local development server. On Vercel the same app is served from api/index.ts.
const config = loadConfig();
const sql = await openDatabase(config);
const app = createApp({ sql, config });
app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
