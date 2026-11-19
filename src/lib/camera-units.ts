// Latest frame of a camera unit. In the demo build it is drawn on request
// by src/app/demo-frame/[unitId]/route.ts.
export function frameUrl(unitId: string) {
  return `/demo-frame/${unitId}`;
}
