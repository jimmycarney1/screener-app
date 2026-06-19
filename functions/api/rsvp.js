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

// No public read API.
export function onRequestGet() {
  return json({ error: "Method not allowed" }, 405);
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

    await env.DB.prepare(
      `INSERT INTO rsvps (guest_id, name, coming, competing, arrive, depart, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(guest_id) DO UPDATE SET
         name = excluded.name,
         coming = excluded.coming,
         competing = excluded.competing,
         arrive = excluded.arrive,
         depart = excluded.depart,
         note = excluded.note,
         updated_at = datetime('now')`
    )
      .bind(guest.id, guest.name, coming, competing, arrive, depart, note)
      .run();

    // Optional contact info — only overwrite when the guest provides a value.
    const email = (data.email || "").toString().trim().slice(0, 200);
    const phone = (data.phone || "").toString().trim().slice(0, 40);
    if (email) {
      await env.DB.prepare("UPDATE guests SET email = ? WHERE id = ?").bind(email, guest.id).run();
    }
    if (phone) {
      await env.DB.prepare("UPDATE guests SET phone = ? WHERE id = ?").bind(phone, guest.id).run();
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: "Something went wrong saving your RSVP." }, 500);
  }
}
