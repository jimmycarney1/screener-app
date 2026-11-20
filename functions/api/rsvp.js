// Cloudflare Pages Function: /api/rsvp
// POST -> record/update the signed-in guest's RSVP (one per guest).
// There is no public GET — the roster lives behind /admin.

const ARRIVE = ["wed", "thu", "fri"];
const DEPART = ["sat", "sun"];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function guestIdFrom(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)jimphi_guest=([^;]+)/);
  if (!m || !m[1].includes(".")) return null;
  const [id, sig] = m[1].split(".");
  if (!/^\d+$/.test(id)) return null;
  const expected = await hmacHex(env.SITE_PASSWORD || "", "guest:" + id);
  return sig === expected ? Number(id) : null;
}

// GET -> the signed-in guest's own RSVP only (used to show their saved answers).
// There is still no way to read anyone else's RSVP; the full roster lives behind /admin.
export async function onRequestGet(context) {
  const { request, env } = context;
  const guestId = await guestIdFrom(request, env);
  if (!guestId) return json({ error: "Please sign in first." }, 401);
  const row = await env.DB.prepare(
    `SELECT g.name, g.email, g.phone, r.coming, r.competing, r.arrive, r.depart, r.note, r.game_ideas
       FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id WHERE g.id = ?`
  ).bind(guestId).first();
  if (!row) return json({ error: "Guest not found." }, 404);
  const plus = await env.DB.prepare("SELECT name FROM rsvps WHERE rsvp_by = ? ORDER BY name").bind(guestId).all();
  const plusOnes = (plus.results || []).map((r) => r.name);
  return new Response(JSON.stringify({ ok: true, rsvp: row.coming ? row : null, plusOnes, guest: { name: row.name, email: row.email, phone: row.phone } }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const guestId = await guestIdFrom(request, env);
    if (!guestId) return json({ error: "Please sign in first." }, 401);

    const guest = await env.DB.prepare("SELECT id, name FROM guests WHERE id = ?")
      .bind(guestId)
      .first();
    if (!guest) return json({ error: "Guest not found." }, 401);

    const data = await request.json();
    const coming = data.coming === "yes" ? "yes" : "no";
    const competing =
      coming === "yes" ? (data.competing === "yes" ? "yes" : "no") : null;
    const arrive =
      coming === "yes" && ARRIVE.includes(data.arrive) ? data.arrive : null;
    const depart =
      coming === "yes" && DEPART.includes(data.depart) ? data.depart : null;
    const note = (data.note || "").toString().slice(0, 500);
    const gameIdeas = (data.gameIdeas || "").toString().slice(0, 500);

    // Resolve plus-one names against the guest list before saving anything.
    const plusNames = (Array.isArray(data.plusOnes) ? data.plusOnes : [])
      .map((n) => (n || "").toString().trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 6);
    const plusGuests = [];
    const unknown = [];
    for (const n of plusNames) {
      const key = n.toLowerCase().replace(/\s+/g, " ");
      const g = await env.DB.prepare(
        "SELECT id, name FROM guests WHERE name_key = ? AND id <> ? ORDER BY id LIMIT 1"
      ).bind(key, guest.id).first();
      if (!g) {
        if (key !== guest.name.toLowerCase().replace(/\s+/g, " ")) unknown.push(n);
        continue;
      }
      if (!plusGuests.some((x) => x.id === g.id)) plusGuests.push(g);
    }
    if (unknown.length) {
      return json({ error: "Not on the guest list: " + unknown.join(", "), unknown }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO rsvps (guest_id, name, coming, competing, arrive, depart, note, game_ideas, rsvp_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))
       ON CONFLICT(guest_id) DO UPDATE SET
         name = excluded.name,
         coming = excluded.coming,
         competing = excluded.competing,
         arrive = excluded.arrive,
         depart = excluded.depart,
         note = excluded.note,
         game_ideas = excluded.game_ideas,
         rsvp_by = NULL,
         updated_at = datetime('now')`
    )
      .bind(guest.id, guest.name, coming, competing, arrive, depart, note, gameIdeas)
      .run();

    // RSVPs for other people on the guest list (plus ones). They get the same answers.
    const saved = [];
    const skipped = [];
    for (const g of plusGuests) {
      const existing = await env.DB.prepare("SELECT rsvp_by FROM rsvps WHERE guest_id = ?").bind(g.id).first();
      // Never overwrite someone who RSVP'd themselves (or was RSVP'd by someone else).
      if (existing && existing.rsvp_by !== guest.id) { skipped.push(g.name); continue; }
      await env.DB.prepare(
        `INSERT INTO rsvps (guest_id, name, coming, competing, arrive, depart, note, game_ideas, rsvp_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, datetime('now'))
         ON CONFLICT(guest_id) DO UPDATE SET
           name = excluded.name, coming = excluded.coming, competing = excluded.competing,
           arrive = excluded.arrive, depart = excluded.depart, note = excluded.note,
           rsvp_by = excluded.rsvp_by, updated_at = datetime('now')`
      )
        .bind(g.id, g.name, coming, competing, arrive, depart, "RSVP'd by " + guest.name, guest.id)
        .run();
      saved.push(g.name);
    }

    // Optional contact info — only overwrite when the guest provides a value.
    const email = (data.email || "").toString().trim().slice(0, 200);
    const phone = (data.phone || "").toString().trim().slice(0, 40);
    if (email) {
      await env.DB.prepare("UPDATE guests SET email = ? WHERE id = ?").bind(email, guest.id).run();
    }
    if (phone) {
      await env.DB.prepare("UPDATE guests SET phone = ? WHERE id = ?").bind(phone, guest.id).run();
    }

    return json({ ok: true, plusOnes: saved, skipped });
  } catch (err) {
    return json({ error: "Something went wrong saving your RSVP." }, 500);
  }
}
