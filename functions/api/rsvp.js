// Cloudflare Pages Function: /api/rsvp
// POST -> record an RSVP (public).
// Listing RSVPs lives in /admin behind Basic Auth — there is intentionally
// no public GET here so the roster can't be read without the password.

const DAYS = ["wed", "thu", "fri"];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// No public read API: GET is explicitly rejected so the roster can't be listed.
export function onRequestGet() {
  return json({ error: "Method not allowed" }, 405);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();

    const name = (data.name || "").toString().trim().slice(0, 120);
    if (!name) return json({ error: "Name is required" }, 400);

    const coming = data.coming === "yes" ? "yes" : "no";
    const competing =
      coming === "yes" ? (data.competing === "yes" ? "yes" : "no") : null;

    const days =
      coming === "yes" && Array.isArray(data.days)
        ? data.days.filter((d) => DAYS.includes(d))
        : [];

    const note = (data.note || "").toString().slice(0, 500);

    await env.DB.prepare(
      `INSERT INTO rsvps (name, coming, competing, days, note)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(name, coming, competing, JSON.stringify(days), note)
      .run();

    return json({ ok: true });
  } catch (err) {
    return json({ error: "Something went wrong saving your RSVP." }, 500);
  }
}
