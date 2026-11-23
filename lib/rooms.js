// Room layout for the house(s). Shared by the admin page and /api/room so they always agree.

export const ROOM_CAP = 2;

function range(prefix, label, n, kind) {
  return Array.from({ length: n }, (_, i) => ({
    key: `${prefix}-${i + 1}`,
    label: `${label} ${i + 1}`,
    kind,
  }));
}

export const BUILDINGS = [
  {
    id: "b1",
    name: "Building 1",
    rooms: [...range("b1-solo", "Solo Bedroom", 5, "solo"), ...range("b1-bunk", "Bunk Room", 3, "bunk")],
  },
  {
    id: "b2",
    name: "Building 2",
    rooms: [...range("b2-solo", "Solo Bedroom", 5, "solo"), ...range("b2-bunk", "Bunk Room", 3, "bunk")],
  },
  {
    id: "b3",
    name: "Building 3",
    rooms: range("b3-solo", "Solo Bed", 4, "solo"),
  },
];

export const ROOMS = new Map(
  BUILDINGS.flatMap((b) => b.rooms.map((r) => [r.key, { ...r, building: b.name }]))
);
