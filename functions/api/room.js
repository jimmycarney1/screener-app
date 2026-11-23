// POST /api/room — room assignments (admin only, HTTP Basic Auth).
//   { id: <guestId>, room: <room key | null> }  assign / unassign a guest
//   { action: "cap", room: <bunk room key>, cap: 2 | 4 }  open up 3rd & 4th spots in a bunk room
// Rooms hold ROOM_CAP (2) people; bunk rooms can be raised to 4.

import { ROOMS, ROOM_CAP } from "../../lib/rooms.js";

const BUNK_MAX = 4;

async function capOf(env, room) {
  if (ROOMS.get(room)?.kind !== "bunk") return ROOM_CAP;
  const row = await env.DB.prepare("SELECT cap FROM room_caps WHERE room = ?").bind(room).first();
  return row?.cap === BUNK_MAX ? BUNK_MAX : ROOM_CAP;
}

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Jimphi Admin", charset="UTF-8"' },
  });
}

function authed(request, env) {
  const expected = env.ADMIN_PASSWORD;
  const header = request.headers.get("Authorization") || "";
  if (!expected || !header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1) === expected;
  } catch (_) {
    return false;
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return unauthorized();

  const data = await request.json().catch(() => ({}));

  if (data.action === "cap") {
    const room = String(data.room || "");
    const info = ROOMS.get(room);
    if (!info || info.kind !== "bunk") return json({ ok: false, error: "Only bunk rooms can add spots" }, 400);
    const cap = Number(data.cap) === BUNK_MAX ? BUNK_MAX : ROOM_CAP;
    if (cap === ROOM_CAP) {
      const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM guests WHERE room = ?").bind(room).first();
      if ((row?.c || 0) > ROOM_CAP) {
        return json({ ok: false, error: `Move someone out of ${info.label} first (it has ${row.c})` }, 409);
      }
    }
    await env.DB.prepare(
      "INSERT INTO room_caps (room, cap) VALUES (?, ?) ON CONFLICT(room) DO UPDATE SET cap = excluded.cap"
    ).bind(room, cap).run();
    return json({ ok: true, cap });
  }

  const id = Number(data.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Bad guest id" }, 400);

  const room = data.room ? String(data.room) : null;
  if (room !== null && !ROOMS.has(room)) return json({ ok: false, error: "Unknown room" }, 400);

  if (room !== null) {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM guests WHERE room = ? AND id <> ?")
      .bind(room, id)
      .first();
    const cap = await capOf(env, room);
    if ((row?.c || 0) >= cap) {
      return json({ ok: false, error: `${ROOMS.get(room).label} is full (${cap} max)` }, 409);
    }
  }

  await env.DB.prepare("UPDATE guests SET room = ? WHERE id = ?").bind(room, id).run();
  return json({ ok: true });
}
