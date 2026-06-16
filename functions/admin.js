// Cloudflare Pages Function: /admin
// Server-rendered guest list + RSVP roster, gated by HTTP Basic Auth (ADMIN_PASSWORD).

const REALM = "Jimphi Admin";
const ARRIVE_LABEL = { wed: "Wed", thu: "Thu", fri: "Fri" };
const DEPART_LABEL = { sat: "Sat", sun: "Sun" };

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let d = 0;
  for (let i = 0; i < ea.length; i++) d |= ea[i] ^ eb[i];
  return d === 0;
}

function esc(s) {
  return s == null
    ? ""
    : String(s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
      );
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const header = request.headers.get("Authorization") || "";
  let ok = false;
  if (env.ADMIN_PASSWORD && header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      ok = safeEqual(decoded.slice(decoded.indexOf(":") + 1), env.ADMIN_PASSWORD);
    } catch (_) {}
  }
  if (!ok) return unauthorized();

  let rows = [];
  try {
    const res = await env.DB.prepare(
      `SELECT g.id, g.name,
              r.coming, r.competing, r.arrive, r.depart, r.note, r.updated_at
         FROM guests g
         LEFT JOIN rsvps r ON r.guest_id = g.id
        ORDER BY g.name COLLATE NOCASE`
    ).all();
    rows = res.results || [];
  } catch (_) {
    return new Response("Could not load data.", { status: 500 });
  }

  return new Response(render(rows), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function render(rows) {
  let invited = rows.length;
  let responded = 0;
  let coming = 0;
  let competing = 0;

  const body = rows
    .map((r) => {
      const has = r.coming != null;
      if (has) responded++;
      if (r.coming === "yes") coming++;
      if (r.competing === "yes") competing++;

      const status = !has
        ? '<span class="pending">— no response —</span>'
        : r.coming === "yes"
        ? '<span class="yes">Coming</span>'
        : '<span class="no">Not coming</span>';

      const compete = !has || r.coming !== "yes"
        ? "—"
        : r.competing === "yes"
        ? "🏅 Yes"
        : "Spectating";
      const arrive = ARRIVE_LABEL[r.arrive] || "—";
      const depart = DEPART_LABEL[r.depart] || "—";
      const when = esc((r.updated_at || "").replace("T", " ").slice(0, 16));

      return `<tr>
        <td>${esc(r.name)}</td>
        <td>${status}</td>
        <td>${compete}</td>
        <td>${arrive}</td>
        <td>${depart}</td>
        <td>${esc(r.note) || ""}</td>
        <td class="when">${when}</td>
        <td><form method="post" action="/api/guests" onsubmit="return confirm('Remove ${esc(r.name)} from the guest list?');">
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="id" value="${r.id}" />
          <button class="del" title="Remove guest">✕</button>
        </form></td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Admin · Jimphi Bachhhhhh Party</title>
  <link href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    main { padding-top: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.93rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid #e3eef4; vertical-align: middle; }
    th { color: var(--ocean-deep); font-weight: 700; }
    .tally { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .pill { background: var(--sand); border-radius: 0.8rem; padding: 0.55rem 0.9rem; font-weight: 600; }
    .pill b { color: var(--coral); font-size: 1.15rem; }
    .yes { color: var(--green); font-weight: 700; }
    .no { color: var(--coral); font-weight: 700; }
    .pending { color: #8aa0ad; font-style: italic; }
    .when { color: #8aa0ad; font-size: 0.82rem; white-space: nowrap; }
    .wrap-table { overflow-x: auto; }
    .add-form { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .add-form input[type=text] { flex: 1 1 200px; }
    .add-form button { font-family: "Fredoka"; font-weight: 600; background: var(--ocean); color: #fff;
      border: none; border-radius: 0.8rem; padding: 0.6rem 1.2rem; cursor: pointer; }
    button.del { background: none; border: none; color: var(--coral); font-weight: 700; cursor: pointer; font-size: 1rem; }
    form { margin: 0; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h2><span class="medal">📋</span> Guest List &amp; RSVPs</h2>
      <div class="tally">
        <span class="pill"><b>${invited}</b> invited</span>
        <span class="pill"><b>${responded}</b> responded</span>
        <span class="pill"><b>${coming}</b> coming</span>
        <span class="pill"><b>${competing}</b> competing</span>
      </div>

      <form class="add-form" method="post" action="/api/guests">
        <input type="hidden" name="action" value="add" />
        <input type="text" name="name" placeholder="Add a guest's name…" required />
        <button type="submit">+ Add guest</button>
      </form>

      <div class="wrap-table">
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Competing</th><th>Arrive</th><th>Leave</th><th>Note</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>${body || '<tr><td colspan="8">No guests yet — add some above.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}
