// Cloudflare Pages Function: /api/rsvp
// POST  -> record an RSVP
// GET   -> list all RSVPs (used by the admin page; unsecured for now)

const DAYS = ["wed", "thu", "fri"];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
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

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, coming, competing, days, note, created_at
       FROM rsvps ORDER BY created_at DESC`
    ).all();
    return json({ rsvps: results });
  } catch (err) {
    return json({ error: "Could not load RSVPs." }, 500);
  }
}
