// Cloudflare Pages Function: /admin
// Server-rendered guest list, RSVP roster, and drag-and-drop team builder.
// Gated by HTTP Basic Auth (ADMIN_PASSWORD).

const REALM = "Jimphi Admin";
const ARRIVE_LABEL = { wed: "Wed", thu: "Thu", fri: "Fri" };
const DEPART_LABEL = { sat: "Sat", sun: "Sun" };
const CAP = 8;
const TEAMS = [1, 2, 3, 4, 5, 6, 7, 8];

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
      `SELECT g.id, g.name, g.team,
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

function chip(g) {
  return `<div class="chip" draggable="true" data-id="${g.id}">${esc(g.name)}</div>`;
}

function column(team, guests) {
  const chips = guests.map(chip).join("");
  const label = team === 0 ? "Unassigned" : `Team ${team}`;
  const counter = team === 0 ? `${guests.length}` : `${guests.length}/${CAP}`;
  const full = team !== 0 && guests.length >= CAP ? " full" : "";
  return `<div class="team-col${team === 0 ? " pool" : ""}${full}" data-team="${team === 0 ? "" : team}">
    <h3>${label} <span class="cnt">${counter}</span></h3>
    <div class="dropzone">${chips}</div>
  </div>`;
}

function render(rows) {
  let invited = rows.length;
  let responded = 0;
  let coming = 0;
  let competing = 0;

  // Roster table
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
      const compete =
        !has || r.coming !== "yes" ? "—" : r.competing === "yes" ? "🏅 Yes" : "Spectating";
      const arrive = ARRIVE_LABEL[r.arrive] || "—";
      const depart = DEPART_LABEL[r.depart] || "—";
      const team = r.team ? `T${r.team}` : "—";
      const when = esc((r.updated_at || "").replace("T", " ").slice(0, 16));

      return `<tr>
        <td>${esc(r.name)}</td>
        <td>${status}</td>
        <td>${compete}</td>
        <td>${arrive}</td>
        <td>${depart}</td>
        <td>${team}</td>
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

  // Team board
  const byTeam = { 0: [] };
  TEAMS.forEach((t) => (byTeam[t] = []));
  rows.forEach((r) => {
    const t = r.team && TEAMS.includes(r.team) ? r.team : 0;
    byTeam[t].push(r);
  });
  const board =
    column(0, byTeam[0]) + TEAMS.map((t) => column(t, byTeam[t])).join("");

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
    main { padding-top: 2rem; max-width: 1000px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 0.5rem 0.45rem; border-bottom: 1px solid #e3eef4; vertical-align: middle; }
    th { color: var(--ocean-deep); font-weight: 700; }
    .tally { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .pill { background: var(--sand); border-radius: 0.8rem; padding: 0.55rem 0.9rem; font-weight: 600; }
    .pill b { color: var(--coral); font-size: 1.15rem; }
    .yes { color: var(--green); font-weight: 700; }
    .no { color: var(--coral); font-weight: 700; }
    .pending { color: #8aa0ad; font-style: italic; }
    .when { color: #8aa0ad; font-size: 0.8rem; white-space: nowrap; }
    .wrap-table { overflow-x: auto; }
    .add-form { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .add-form input[type=text] { flex: 1 1 200px; }
    .add-form button { font-family: "Fredoka"; font-weight: 600; background: var(--ocean); color: #fff;
      border: none; border-radius: 0.8rem; padding: 0.6rem 1.2rem; cursor: pointer; }
    button.del { background: none; border: none; color: var(--coral); font-weight: 700; cursor: pointer; font-size: 1rem; }
    form { margin: 0; }

    /* Team board */
    .hint { color: #6a7f8c; margin-bottom: 1rem; font-size: 0.95rem; }
    .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.9rem; }
    .team-col { background: var(--sand); border-radius: 1rem; padding: 0.8rem; border: 2px solid transparent; min-height: 90px; }
    .team-col.pool { background: #eef6fb; grid-column: 1 / -1; }
    .team-col h3 { font-size: 1rem; color: var(--ocean-deep); margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center; }
    .team-col .cnt { font-size: 0.85rem; font-weight: 700; color: var(--ocean); background: #fff; border-radius: 0.6rem; padding: 0.1rem 0.5rem; }
    .team-col.full .cnt { color: var(--coral); }
    .team-col.drag-over { border-color: var(--ocean); background: #dff1fb; }
    .team-col.full.drag-over { border-color: var(--coral); background: #ffe6e3; }
    .dropzone { display: flex; flex-wrap: wrap; gap: 0.4rem; min-height: 40px; }
    .pool .dropzone { min-height: 50px; }
    .chip { background: #fff; border: 2px solid #d8e6ee; border-radius: 0.7rem; padding: 0.35rem 0.7rem;
      font-weight: 600; font-size: 0.9rem; cursor: grab; user-select: none; box-shadow: 0 2px 5px rgba(0,103,156,0.08); }
    .chip:active { cursor: grabbing; }
    .chip.dragging { opacity: 0.4; }
    .board-msg { min-height: 1.2em; margin-top: 0.8rem; font-weight: 600; color: var(--coral); }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h2><span class="medal">🏟️</span> Team Builder</h2>
      <p class="hint">Drag a name into a team. Max ${CAP} per team — full teams won't accept more. Saves automatically. (Teams are 1–8 for now; we'll make them countries later.)</p>
      <div class="board" id="board">${board}</div>
      <p class="board-msg" id="board-msg" role="status" aria-live="polite"></p>
    </section>

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
            <tr><th>Name</th><th>Status</th><th>Competing</th><th>Arrive</th><th>Leave</th><th>Team</th><th>Note</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>${body || '<tr><td colspan="9">No guests yet — add some above.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </main>

  <script>
    const CAP = ${CAP};
    const board = document.getElementById("board");
    const msg = document.getElementById("board-msg");
    let dragId = null;
    let dragEl = null;

    function refreshCounts() {
      board.querySelectorAll(".team-col").forEach((col) => {
        const isPool = col.classList.contains("pool");
        const n = col.querySelectorAll(".chip").length;
        col.querySelector(".cnt").textContent = isPool ? String(n) : n + "/" + CAP;
        if (!isPool) col.classList.toggle("full", n >= CAP);
      });
    }

    board.addEventListener("dragstart", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      dragId = chip.dataset.id;
      dragEl = chip;
      chip.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    board.addEventListener("dragend", () => {
      if (dragEl) dragEl.classList.remove("dragging");
      dragId = null; dragEl = null;
      board.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
    });

    board.querySelectorAll(".team-col").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        if (!dragEl) return;
        const fromCol = dragEl.closest(".team-col");
        if (fromCol === col) return;
        const team = col.dataset.team || null; // "" -> unassigned
        const isPool = col.classList.contains("pool");
        const count = col.querySelectorAll(".chip").length;
        if (!isPool && count >= CAP) { flash("Team " + team + " is full (" + CAP + " max)"); return; }

        const zone = col.querySelector(".dropzone");
        const placeholder = dragEl;
        const prevParent = placeholder.parentNode;
        zone.appendChild(placeholder);
        refreshCounts();
        msg.textContent = "";

        try {
          const res = await fetch("/api/team", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: Number(dragId), team: team ? Number(team) : null }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
        } catch (err) {
          prevParent.appendChild(placeholder); // revert
          refreshCounts();
          flash(err.message || "Couldn't save — try again");
        }
      });
    });

    function flash(text) {
      msg.textContent = text;
      setTimeout(() => { if (msg.textContent === text) msg.textContent = ""; }, 3000);
    }
  </script>
</body>
</html>`;
}
