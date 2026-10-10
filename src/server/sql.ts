import postgres from "postgres";

export type SqlParam = string | number | boolean | null;
export type Queryable = { query<T>(text: string, params?: SqlParam[]): Promise<T[]> };
export type Sql = Queryable & {
  transaction<T>(operation: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

// BIGINT columns hold millisecond timestamps and counts; both fit in a JS number.
const parseBigint = (value: string) => Number(value);

export function createPostgresSql(url: string): Sql {
  // prepare: false keeps queries compatible with Supabase's transaction pooler.
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, types: { bigint: { to: 20, from: [20], serialize: String, parse: parseBigint } } });
  const wrap = (runner: postgres.Sql | postgres.TransactionSql): Queryable => ({
    async query<T>(text: string, params: SqlParam[] = []) { return [...await runner.unsafe(text, params)] as T[]; },
  });
  return {
    ...wrap(client),
    async transaction(operation) { return client.begin((tx) => operation(wrap(tx))) as Promise<Awaited<ReturnType<typeof operation>>>; },
    async close() { await client.end({ timeout: 5 }); },
  };
}

export async function createPgliteSql(dataDir?: string): Promise<Sql> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const db = new PGlite(dataDir, { parsers: { [types.INT8]: parseBigint } });
  const wrap = (runner: { query: typeof db.query }): Queryable => ({
    async query<T>(text: string, params: SqlParam[] = []) { return (await runner.query<T>(text, params)).rows; },
  });
  return {
    ...wrap(db),
    async transaction(operation) { return db.transaction((tx) => operation(wrap(tx))); },
    async close() { await db.close(); },
  };
}
