// Distances between a person and a building, for the Nearest sort and the
// "0.2 mi" caption. Great-circle distance is plenty at campus scale.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

// "450 ft" under a tenth of a mile, "0.2 mi" from there.
export function distanceText(m: number): string {
  const miles = m / METERS_PER_MILE;
  if (miles < 0.1) return `${Math.round((m * FEET_PER_METER) / 50) * 50} ft`;
  return `${miles.toFixed(1)} mi`;
}
