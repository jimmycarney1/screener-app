// POST /api/team — assign a guest to a team (admin only, HTTP Basic Auth).
// Body: { id: <guestId>, team: <1..8 | null> }
// Enforces a max of 8 guests per team.

const CAP = 8;

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
  const id = Number(data.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Bad guest id" }, 400);

  let team = data.team;
  if (team === null || team === "" || team === undefined) {
    team = null;
  } else {
    team = Number(team);
    if (!Number.isInteger(team) || team < 1 || team > 8) {
      return json({ ok: false, error: "Team must be 1-8" }, 400);
    }
  }

  if (team !== null) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM guests WHERE team = ? AND id <> ?"
    )
      .bind(team, id)
      .first();
    if ((row?.c || 0) >= CAP) {
      return json({ ok: false, error: `Team ${team} is full (${CAP} max)` }, 409);
    }
  }

  await env.DB.prepare("UPDATE guests SET team = ? WHERE id = ?").bind(team, id).run();
  return json({ ok: true });
}
