import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, filterValue, isLookup, type Responder } from "./fake-supabase";

let fake = createFakeSupabase();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { POST } = await import("@/app/api/frame/route");

const URL = "http://localhost/api/frame";
const SUPABASE_URL = "https://example.supabase.co";

const knownUnit: Responder = (q) =>
  isLookup(q, "camera_units", "api_key")
    ? { data: filterValue(q, "api_key") === "good-key" ? { id: "unit-1", name: "Camera unit 123456", room_id: "room-1" } : null }
    : undefined;

function frameRequest(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request(URL, {
    method: "POST",
    headers: { "x-api-key": "good-key", "content-type": "image/jpeg", ...headers },
    body,
  });
}

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function heartbeats() {
  return fake.queries.filter((q) => q.table === "camera_units" && q.op === "update");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  fake = createFakeSupabase(knownUnit);
});

describe("POST /api/frame: request checks", () => {
  it("returns 401 without an x-api-key header", async () => {
    const res = await POST(frameRequest(jpeg(), { "x-api-key": "" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Missing x-api-key header" });
  });

  it("returns 401 for a header that is only whitespace", async () => {
    const res = await POST(frameRequest(jpeg(), { "x-api-key": "   " }));
    expect(res.status).toBe(401);
  });

  it("returns 415 for a body that is not a JPEG", async () => {
    const res = await POST(frameRequest("hello", { "content-type": "text/plain" }));
    expect(res.status).toBe(415);
    expect(fake.uploads).toHaveLength(0);
  });

  it("returns 413 for an empty body", async () => {
    const res = await POST(frameRequest(new Uint8Array(0)));
    expect(res.status).toBe(413);
  });

  it("returns 413 for a frame over 2 MB", async () => {
    const res = await POST(frameRequest(new Uint8Array(2 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
    expect(fake.uploads).toHaveLength(0);
  });

  it("returns 401 for an unknown api_key and uploads nothing", async () => {
    const res = await POST(frameRequest(jpeg(), { "x-api-key": "wrong-key" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unknown api_key" });
    expect(fake.uploads).toHaveLength(0);
  });
});

describe("POST /api/frame: upload", () => {
  it("stores the latest frame per unit and returns its public URL", async () => {
    const res = await POST(frameRequest(jpeg()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      url: `${SUPABASE_URL}/storage/v1/object/public/frames/unit-1.jpg`,
    });

    expect(fake.uploads).toHaveLength(1);
    const [upload] = fake.uploads;
    expect(upload.bucket).toBe("frames");
    expect(upload.path).toBe("unit-1.jpg");
    expect(upload.bytes.byteLength).toBe(jpeg().byteLength);
    expect(upload.options).toMatchObject({ contentType: "image/jpeg", upsert: true });
  });

  it("counts a frame as a heartbeat", async () => {
    await POST(frameRequest(jpeg()));
    expect(heartbeats()).toHaveLength(1);
    expect(filterValue(heartbeats()[0], "id")).toBe("unit-1");
  });

  it("returns 500 and skips the heartbeat when storage fails", async () => {
    fake = createFakeSupabase(knownUnit, { error: { message: "bucket missing" } });
    const res = await POST(frameRequest(jpeg()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "bucket missing" });
    expect(heartbeats()).toHaveLength(0);
  });
});
