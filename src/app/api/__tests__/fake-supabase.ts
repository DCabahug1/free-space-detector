// A small stand-in for the Supabase service role client used by the API
// routes. Every query is recorded, and a test decides what each one returns
// by passing a responder. Only the builder methods the routes use exist.

export type QueryOp = "select" | "insert" | "update" | "upsert";

export type Filter =
  | { kind: "eq" | "neq"; column: string; value: unknown }
  | { kind: "not"; column: string; operator: string; value: unknown }
  | { kind: "or"; expression: string };

export type Query = {
  table: string;
  op: QueryOp;
  columns?: string;
  payload?: unknown;
  options?: unknown;
  filters: Filter[];
  returning: boolean;
  single: "single" | "maybeSingle" | null;
};

export type Result = { data?: unknown; error?: { message: string; code?: string } | null };

export type Responder = (query: Query) => Result | undefined;

export type Upload = {
  bucket: string;
  path: string;
  bytes: ArrayBuffer;
  options: unknown;
};

export function createFakeSupabase(
  respond: Responder = () => undefined,
  uploadResult: { error: { message: string } | null } = { error: null }
) {
  const queries: Query[] = [];
  const uploads: Upload[] = [];

  function builder(table: string) {
    let query: Query | null = null;

    const start = (op: QueryOp, payload?: unknown, options?: unknown) => {
      query = { table, op, payload, options, filters: [], returning: false, single: null };
      queries.push(query);
      return chain;
    };

    const current = () => {
      if (!query) throw new Error(`No operation started on ${table}`);
      return query;
    };

    const resolve = () => {
      const result = respond(current()) ?? {};
      return { data: result.data ?? null, error: result.error ?? null };
    };

    const chain = {
      select(columns?: string) {
        if (query) {
          // select() after insert/update means "return the rows".
          query.returning = true;
          query.columns = columns;
          return chain;
        }
        start("select");
        current().columns = columns;
        return chain;
      },
      insert: (payload: unknown) => start("insert", payload),
      update: (payload: unknown) => start("update", payload),
      upsert: (payload: unknown, options?: unknown) => start("upsert", payload, options),
      eq(column: string, value: unknown) {
        current().filters.push({ kind: "eq", column, value });
        return chain;
      },
      neq(column: string, value: unknown) {
        current().filters.push({ kind: "neq", column, value });
        return chain;
      },
      not(column: string, operator: string, value: unknown) {
        current().filters.push({ kind: "not", column, operator, value });
        return chain;
      },
      or(expression: string) {
        current().filters.push({ kind: "or", expression });
        return chain;
      },
      single() {
        current().single = "single";
        return Promise.resolve(resolve());
      },
      maybeSingle() {
        current().single = "maybeSingle";
        return Promise.resolve(resolve());
      },
      then<T>(onFulfilled: (value: ReturnType<typeof resolve>) => T, onRejected?: (reason: unknown) => T) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    storage: {
      from: (bucket: string) => ({
        upload(path: string, bytes: ArrayBuffer, options: unknown) {
          uploads.push({ bucket, path, bytes, options });
          return Promise.resolve(uploadResult);
        },
      }),
    },
  };

  return { client, queries, uploads };
}

// Helpers for writing responders and assertions.

export function filterValue(query: Query, column: string) {
  for (const f of query.filters) {
    if (f.kind === "eq" && f.column === column) return f.value;
  }
  return undefined;
}

export function isLookup(query: Query, table: string, column: string) {
  return query.table === table && query.op === "select" && filterValue(query, column) !== undefined;
}

export function jsonRequest(url: string, body: unknown, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
