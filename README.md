# free-space-detector

Working name. Passive camera units count people inside hand-drawn zones and publish live occupancy to a public map.

See `CLAUDE.md` for the full brief, terms, schema, and build order.

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in SUPABASE_SERVICE_ROLE_KEY
pnpm dev
```

## Routes

- `/` public map
- `/admin` admin app (auth-gated)
- `POST /api/ingest` camera units post `{ api_key, counts: [{ zone_id, count }] }` every 30 s

## Database

Migrations live in `supabase/migrations/` and are applied to the Supabase project via MCP.
