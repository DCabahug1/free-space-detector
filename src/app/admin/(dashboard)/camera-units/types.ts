import type { CameraUnit, Room } from "@/lib/types";

export type CameraUnitRow = Omit<CameraUnit, "api_key"> & {
  rooms: Pick<Room, "id" | "name"> | null;
};
