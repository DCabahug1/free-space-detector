import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterValue, isLookup, jsonRequest, type Responder } from "./fake-supabase";

let fake = createFakeSupabase();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { POST } = await import("@/app/api/ingest/route");

const URL = "http://localhost/api/ingest";
const UNIT = { id: "unit-1", room_id: "room-1" };
const ZONE_A = "11111111-1111-4111-8111-111111111111";
const ZONE_B = "22222222-2222-4222-8222-222222222222";
const OTHER_ROOM_ZONE = "33333333-3333-4333-8333-333333333333";

// A camera unit with api_key "good-key" in room-1, which has zones A and B.
const pairedUnit: Responder = (q) => {
  if (isLookup(q, "camera_units", "api_key")) {
    return { data: filterValue(q, "api_key") === "good-key" ? UNIT : null };
  }
  if (q.table === "zones" && q.op === "select") {
    return { data: [{ id: ZONE_A }, { id: ZONE_B }] };
  }
  return undefined;
};

function upserts() {
  return fake.queries.filter((q) => q.table === "zone_counts" && q.op === "upsert");
}

function heartbeats() {
  return fake.queries.filter(
    (q) => q.table === "camera_units" && q.op === "update" && "last_seen" in (q.payload as object)
  );
}

beforeEach(() => {
  fake = createFakeSupabase(pairedUnit);
});

describe("POST /api/ingest: request validation", () => {
  it("rejects a body that is not JSON", async () => {
    const res = await POST(jsonRequest(URL, "{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
    expect(fake.queries).toHaveLength(0);
  });

  it("rejects a missing api_key", async () => {
    const res = await POST(jsonRequest(URL, { counts: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid body");
  });

  it("rejects a zone_id that is not a uuid", async () => {
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [{ zone_id: "table-1", count: 1 }] }));
    expect(res.status).toBe(400);
  });

  it("rejects negative and non-integer counts", async () => {
    for (const count of [-1, 1.5, 1001]) {
      const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [{ zone_id: ZONE_A, count }] }));
      expect(res.status, `count ${count}`).toBe(400);
    }
  });

  it("rejects more than 200 counts", async () => {
    const counts = Array.from({ length: 201 }, () => ({ zone_id: ZONE_A, count: 0 }));
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ingest: auth", () => {
  it("returns 401 for an unknown api_key and writes nothing", async () => {
    const res = await POST(jsonRequest(URL, { api_key: "wrong-key", counts: [{ zone_id: ZONE_A, count: 1 }] }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unknown api_key" });
    expect(heartbeats()).toHaveLength(0);
    expect(upserts()).toHaveLength(0);
  });

  it("returns 500 when the camera unit lookup fails", async () => {
    fake = createFakeSupabase((q) =>
      isLookup(q, "camera_units", "api_key") ? { error: { message: "db down" } } : undefined
    );
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db down" });
  });
});

describe("POST /api/ingest: counts", () => {
  it("records a heartbeat and accepts nothing when the unit has no area", async () => {
    fake = createFakeSupabase((q) =>
      isLookup(q, "camera_units", "api_key") ? { data: { id: "unit-1", room_id: null } } : undefined
    );
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [{ zone_id: ZONE_A, count: 2 }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, accepted: 0 });
    expect(heartbeats()).toHaveLength(1);
    expect(filterValue(heartbeats()[0], "id")).toBe("unit-1");
    expect(upserts()).toHaveLength(0);
  });

  it("treats an empty counts list as a heartbeat", async () => {
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accepted: 0, ignored: 0 });
    expect(heartbeats()).toHaveLength(1);
    expect(upserts()).toHaveLength(0);
  });

  it("upserts counts for the unit's own zones", async () => {
    const res = await POST(
      jsonRequest(URL, {
        api_key: "good-key",
        counts: [
          { zone_id: ZONE_A, count: 2 },
          { zone_id: ZONE_B, count: 0 },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accepted: 2, ignored: 0 });

    const [upsert] = upserts();
    expect(upsert.options).toEqual({ onConflict: "zone_id" });
    expect(upsert.payload).toEqual([
      { zone_id: ZONE_A, count: 2, updated_at: expect.any(String) },
      { zone_id: ZONE_B, count: 0, updated_at: expect.any(String) },
    ]);
  });

  it("ignores zones from another area so a leaked key cannot write them", async () => {
    const res = await POST(
      jsonRequest(URL, {
        api_key: "good-key",
        counts: [
          { zone_id: ZONE_A, count: 1 },
          { zone_id: OTHER_ROOM_ZONE, count: 9 },
        ],
      })
    );
    expect(await res.json()).toEqual({ ok: true, accepted: 1, ignored: 1 });
    expect(upserts()[0].payload).toEqual([{ zone_id: ZONE_A, count: 1, updated_at: expect.any(String) }]);
  });

  it("only looks up zones in the unit's own area", async () => {
    await POST(jsonRequest(URL, { api_key: "good-key", counts: [{ zone_id: ZONE_A, count: 1 }] }));
    const zoneQuery = fake.queries.find((q) => q.table === "zones");
    expect(filterValue(zoneQuery!, "room_id")).toBe("room-1");
  });

  it("returns 500 when the upsert fails", async () => {
    fake = createFakeSupabase((q) =>
      q.table === "zone_counts" ? { error: { message: "upsert failed" } } : pairedUnit(q)
    );
    const res = await POST(jsonRequest(URL, { api_key: "good-key", counts: [{ zone_id: ZONE_A, count: 1 }] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "upsert failed" });
  });
});
