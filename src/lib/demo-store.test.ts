import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { demoDb } from "./demo-store";

describe("demo store", () => {
  it("seeds valid, deterministic ids", () => {
    const db = demoDb();
    expect(db.buildings.length).toBeGreaterThan(0);
    for (const r of db.rooms) expect(z.string().uuid().safeParse(r.id).success).toBe(true);
    expect(db.buildings[0].id).toBe("00000000-0000-4000-8000-000000000001");
    expect(db.zones.every((z) => z.type === "seating" && (z.capacity ?? 0) > 0)).toBe(true);
  });

  it("keeps counts within capacity and units online across ticks", () => {
    const db = demoDb();
    vi.useFakeTimers();
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(10_000);
      demoDb();
    }
    for (const z of db.zones) {
      const c = db.counts.get(z.id)!.count;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(z.capacity!);
    }
    expect(db.units.every((u) => Date.now() - Date.parse(u.last_seen!) < 1000)).toBe(true);
    vi.useRealTimers();
  });
});
