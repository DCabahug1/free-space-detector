import { connection } from "next/server";
import { demoDb } from "@/lib/demo-store";

// Demo stand-in for a camera unit's uploaded frame: a top-down sketch of the
// unit's area drawn from its zones, one table per zone and a person in a
// chair for each counted seat. Same 1280x720 frame as the zone canvas.
const W = 1280;
const H = 720;

export async function GET(_req: Request, { params }: { params: Promise<{ unitId: string }> }) {
  await connection();
  const { unitId } = await params;
  const db = demoDb();
  const unit = db.units.find((u) => u.id === unitId);
  const zones = unit?.room_id ? db.zones.filter((z) => z.room_id === unit.room_id) : [];

  const shapes = zones.map((z) => {
    const xs = z.polygon.map((p) => p[0]);
    const ys = z.polygon.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = x1 - x0;
    const h = y1 - y0;
    // Table in the middle half of the zone, chairs split along its long sides.
    const t = { x: x0 + w * 0.25, y: y0 + h * 0.3, w: w * 0.5, h: h * 0.4 };
    const seats = z.capacity ?? 1;
    const taken = db.counts.get(z.id)?.count ?? 0;
    const top = Math.ceil(seats / 2);
    const chairs = Array.from({ length: seats }, (_, i) => {
      const row = i < top ? 0 : 1;
      const n = row === 0 ? top : seats - top;
      const k = row === 0 ? i : i - top;
      const cx = t.x + (t.w * (k + 1)) / (n + 1);
      const cy = row === 0 ? t.y - h * 0.09 : t.y + t.h + h * 0.09;
      const r = Math.min(26, h * 0.07, t.w / (n * 2.4));
      const person =
        i < taken
          ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="#3b4250"/><circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="#2a1f1a"/>`
          : "";
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.4}" fill="#7d8592"/>${person}`;
    });
    return `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="10" fill="#a97c50" stroke="#6e4f31" stroke-width="3"/>${chairs.join("")}`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<pattern id="tile" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#c9c4bb"/><path d="M80 0H0V80" fill="none" stroke="#b8b2a7" stroke-width="2"/></pattern>
<radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.45"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#tile)"/>
${shapes.join("\n")}
<rect width="${W}" height="${H}" fill="url(#v)"/>
<text x="24" y="${H - 24}" font-family="monospace" font-size="22" fill="#fff" fill-opacity="0.85">${new Date().toISOString().slice(0, 19).replace("T", " ")}</text>
</svg>`;

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
