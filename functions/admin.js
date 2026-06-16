// Cloudflare Pages Function: /admin
// Server-rendered RSVP roster, gated by HTTP Basic Auth.
// Password is read from the ADMIN_PASSWORD secret (set via `wrangler pages secret put`).
// Any username works — only the password is checked.

const REALM = 'Jimphi Admin';
const DAY_LABEL = { wed: 'Wed', thu: 'Thu', fri: 'Fri' };

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

// Constant-time string comparison to avoid leaking the password via timing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function esc(s) {
  return s == null
    ? ''
    : String(s).replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
      );
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const expected = env.ADMIN_PASSWORD;
  const header = request.headers.get('Authorization') || '';
  let ok = false;
  if (expected && header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      ok = safeEqual(pass, expected);
    } catch (_) {
      ok = false;
    }
  }
  if (!ok) return unauthorized();

  let rows = [];
  try {
    const res = await env.DB.prepare(
      `SELECT id, name, coming, competing, days, note, created_at
       FROM rsvps ORDER BY created_at DESC`
    ).all();
    rows = res.results || [];
  } catch (_) {
    return new Response('Could not load RSVPs.', { status: 500 });
  }

  return new Response(render(rows), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function render(rows) {
  let coming = 0;
  let competing = 0;
  const body = rows
    .map((r) => {
      if (r.coming === 'yes') coming++;
      if (r.competing === 'yes') competing++;
      let days = [];
      try {
        days = JSON.parse(r.days || '[]');
      } catch (_) {}
      const dayStr = days.map((d) => DAY_LABEL[d] || d).join(', ');
      const comeCls = r.coming === 'yes' ? 'yes' : 'no';
      const compete = r.competing
        ? r.competing === 'yes'
          ? '🏅 Yes'
          : 'Spectating'
        : '—';
      const when = esc((r.created_at || '').replace('T', ' ').slice(0, 16));
      return `<tr>
        <td>${esc(r.name)}</td>
        <td class="${comeCls}">${r.coming === 'yes' ? 'Yes' : 'No'}</td>
        <td>${compete}</td>
        <td>${esc(dayStr) || '—'}</td>
        <td>${esc(r.note) || ''}</td>
        <td>${when}</td>
      </tr>`;
    })
    .join('');

  const tally = rows.length
    ? `<span class="pill"><b>${coming}</b> coming</span>` +
      `<span class="pill"><b>${competing}</b> competing</span>` +
      `<span class="pill"><b>${rows.length}</b> total responses</span>`
    : '';

  const tbody = rows.length
    ? body
    : '<tr><td colspan="6">No RSVPs yet.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>RSVPs · Jimphi Bachhhhhh Party</title>
  <link href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    main { padding-top: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid #e3eef4; vertical-align: top; }
    th { color: var(--ocean-deep); font-weight: 700; }
    .tally { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .pill { background: var(--sand); border-radius: 0.8rem; padding: 0.6rem 1rem; font-weight: 600; }
    .pill b { color: var(--coral); font-size: 1.2rem; }
    .yes { color: var(--green); font-weight: 600; }
    .no { color: var(--coral); font-weight: 600; }
    .wrap-table { overflow-x: auto; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h2><span class="medal">📋</span> RSVP Roster</h2>
      <div class="tally">${tally}</div>
      <div class="wrap-table">
        <table>
          <thead>
            <tr><th>Name</th><th>Coming</th><th>Competing</th><th>Days</th><th>Note</th><th>When</th></tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}
