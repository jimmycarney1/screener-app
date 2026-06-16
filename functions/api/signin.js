// POST /api/signin — match a typed name against the guest list and, on success,
// set a signed cookie tying the visitor to that guest record.

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const data = await request.json().catch(() => ({}));
  const key = normalize((data && data.name ? data.name : "").toString());
  if (!key) return json({ ok: false, error: "Please enter your name." }, 400);

  // Prefer a matching guest who hasn't RSVP'd yet (handles duplicate first names).
  const guest = await env.DB.prepare(
    `SELECT g.id, g.name
       FROM guests g
       LEFT JOIN rsvps r ON r.guest_id = g.id
      WHERE g.name_key = ?
      ORDER BY (r.id IS NOT NULL) ASC, g.id ASC
      LIMIT 1`
  )
    .bind(key)
    .first();

  if (!guest) return json({ ok: false, error: "Name not found" }, 404);

  const sig = await hmacHex(env.SITE_PASSWORD || "", "guest:" + guest.id);
  const id = String(guest.id);
  const headers = new Headers({ "content-type": "application/json" });
  const opts = "Path=/; Secure; SameSite=Lax; Max-Age=31536000";
  headers.append("Set-Cookie", `jimphi_guest=${id}.${sig}; HttpOnly; ${opts}`);
  headers.append(
    "Set-Cookie",
    `jimphi_guest_name=${encodeURIComponent(guest.name)}; ${opts}`
  );
  return new Response(JSON.stringify({ ok: true, name: guest.name }), { status: 200, headers });
}
