import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterValue, isLookup, jsonRequest, type Query, type Responder } from "./fake-supabase";

let fake = createFakeSupabase();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const register = await import("@/app/api/pair/register/route");
const status = await import("@/app/api/pair/status/route");

const STATUS_URL = "http://localhost/api/pair/status";

function inserts() {
  return fake.queries.filter((q) => q.table === "camera_units" && q.op === "insert");
}

function updatesWith(key: string) {
  return fake.queries.filter(
    (q) => q.table === "camera_units" && q.op === "update" && key in (q.payload as object)
  );
}

// Echo the inserted pair code back, like the real table does.
const insertOk = (q: Query) => ({
  data: { id: "unit-9", pair_code: (q.payload as { pair_code: string }).pair_code, api_key: "key-9" },
});

describe("POST /api/pair/register", () => {
  it("creates a camera unit with a 6-digit pair code and returns its api_key", async () => {
    fake = createFakeSupabase((q) => (q.op === "insert" ? insertOk(q) : undefined));
    const res = await register.POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ ok: true, unit_id: "unit-9", api_key: "key-9" });
    expect(body.pair_code).toMatch(/^\d{6}$/);

    const [insert] = inserts();
    expect(insert.payload).toEqual({ pair_code: body.pair_code, name: `Camera unit ${body.pair_code}` });
  });

  it("retries with a new code when the pair code is already taken", async () => {
    let calls = 0;
    fake = createFakeSupabase((q) => {
      if (q.op !== "insert") return undefined;
      calls++;
      return calls < 3 ? { error: { message: "duplicate key", code: "23505" } } : insertOk(q);
    });
    const res = await register.POST();
    expect(res.status).toBe(200);
    expect(inserts()).toHaveLength(3);
  });

  it("gives up after 5 taken codes", async () => {
    fake = createFakeSupabase((q) =>
      q.op === "insert" ? { error: { message: "duplicate key", code: "23505" } } : undefined
    );
    const res = await register.POST();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not allocate a pair code" });
    expect(inserts()).toHaveLength(5);
  });

  it("stops at once on any other database error", async () => {
    fake = createFakeSupabase((q) =>
      q.op === "insert" ? { error: { message: "permission denied", code: "42501" } } : undefined
    );
    const res = await register.POST();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "permission denied" });
    expect(inserts()).toHaveLength(1);
  });
});

type UnitState = {
  room_id: string | null;
  updateRequested?: boolean;
  room?: { id: string; name: string; buildings: unknown } | null;
};

function statusResponder(state: UnitState): Responder {
  return (q) => {
    if (isLookup(q, "camera_units", "api_key")) {
      return filterValue(q, "api_key") === "good-key"
        ? { data: { id: "unit-1", name: "Camera unit 123456", room_id: state.room_id } }
        : { data: null };
    }
    if (q.table === "camera_units" && q.op === "update" && "update_requested_at" in (q.payload as object)) {
      return { data: state.updateRequested ? [{ id: "unit-1" }] : [] };
    }
    if (q.table === "rooms") {
      return { data: state.room ?? null };
    }
    return undefined;
  };
}

describe("POST /api/pair/status: request checks", () => {
  beforeEach(() => {
    fake = createFakeSupabase(statusResponder({ room_id: null }));
  });

  it("rejects a body that is not JSON", async () => {
    const res = await status.POST(jsonRequest(STATUS_URL, "nope"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("rejects a missing api_key, a non-boolean sharing flag and an oversized version", async () => {
    const bodies = [{}, { api_key: "good-key", sharing: "yes" }, { api_key: "good-key", version: "a".repeat(65) }];
    for (const body of bodies) {
      const res = await status.POST(jsonRequest(STATUS_URL, body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("returns 401 for an unknown api_key", async () => {
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "wrong-key" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unknown api_key" });
  });
});

describe("POST /api/pair/status: pairing", () => {
  it("reports an unclaimed unit as not paired", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: null }));
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      paired: false,
      unit_id: "unit-1",
      name: "Camera unit 123456",
      update_requested: false,
    });
  });

  it("reports the area and building once an admin has claimed the unit", async () => {
    fake = createFakeSupabase(
      statusResponder({
        room_id: "room-1",
        room: { id: "room-1", name: "Floor 2", buildings: { name: "University Library" } },
      })
    );
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect(await res.json()).toEqual({
      ok: true,
      paired: true,
      unit_id: "unit-1",
      name: "Camera unit 123456",
      room_id: "room-1",
      room_name: "Floor 2",
      building_name: "University Library",
      update_requested: false,
    });
  });

  it("reads the building name when Supabase returns it as an array", async () => {
    fake = createFakeSupabase(
      statusResponder({
        room_id: "room-1",
        room: { id: "room-1", name: "Floor 2", buildings: [{ name: "Sierra Hall" }] },
      })
    );
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect((await res.json()).building_name).toBe("Sierra Hall");
  });

  it("returns null names when the assigned area no longer exists", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-gone", room: null }));
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect(await res.json()).toMatchObject({ paired: true, room_name: null, building_name: null });
  });

  it("is not a heartbeat", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key", sharing: true, version: "abc1234" }));
    expect(updatesWith("last_seen")).toHaveLength(0);
  });
});

describe("POST /api/pair/status: remote update, sharing and version", () => {
  it("hands over a pending update request once and clears it", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1", updateRequested: true }));
    const res = await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect((await res.json()).update_requested).toBe(true);

    const [clear] = updatesWith("update_requested_at");
    expect(clear.payload).toEqual({ update_requested_at: null });
    expect(clear.returning).toBe(true);
  });

  it("stores paused = true when the unit stops sharing", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key", sharing: false }));
    const [paused] = updatesWith("paused");
    expect(paused.payload).toEqual({ paused: true });
  });

  it("leaves paused alone when sharing is not sent", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key" }));
    expect(updatesWith("paused")).toHaveLength(0);
  });

  it("stores the reported git hash", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key", version: "2df0724" }));
    const [version] = updatesWith("version");
    expect(version.payload).toEqual({ version: "2df0724" });
  });

  it("strips non-hex characters from version so it cannot change the filter", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key", version: "2df0724),id.neq.(x" }));
    const [version] = updatesWith("version");
    expect(version.payload).toEqual({ version: "2df0724de" });
    const or = version.filters.find((f) => f.kind === "or");
    expect(or).toEqual({ kind: "or", expression: "version.is.null,version.neq.2df0724de" });
  });

  it("skips the version write when nothing hex is left", async () => {
    fake = createFakeSupabase(statusResponder({ room_id: "room-1" }));
    await status.POST(jsonRequest(STATUS_URL, { api_key: "good-key", version: "unknown" }));
    expect(updatesWith("version")).toHaveLength(0);
  });
});
