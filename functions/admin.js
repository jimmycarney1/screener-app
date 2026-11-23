// Cloudflare Pages Function: /admin
// Server-rendered guest list, RSVP roster, drag-and-drop team builder, and room assignments.
// Gated by HTTP Basic Auth (ADMIN_PASSWORD).

import { BUILDINGS, ROOMS, ROOM_CAP } from "../lib/rooms.js";

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
      `SELECT g.id, g.name, g.team, g.is_captain, g.email, g.phone, g.room,
              r.coming, r.competing, r.arrive, r.depart, r.note, r.game_ideas, r.updated_at,
              b.name AS rsvp_by_name
         FROM guests g
         LEFT JOIN rsvps r ON r.guest_id = g.id
         LEFT JOIN guests b ON b.id = r.rsvp_by
        ORDER BY g.name COLLATE NOCASE`
    ).all();
    rows = res.results || [];
  } catch (_) {
    return new Response("Could not load data.", { status: 500 });
  }

  let todos = [];
  try {
    const t = await env.DB.prepare(
      "SELECT id, text, done FROM todos ORDER BY done ASC, id ASC"
    ).all();
    todos = t.results || [];
  } catch (_) {}

  let gameIdeas = [];
  try {
    const g = await env.DB.prepare(
      "SELECT id, text, done FROM game_ideas ORDER BY done ASC, id ASC"
    ).all();
    gameIdeas = g.results || [];
  } catch (_) {}

  const roomCaps = {};
  try {
    const c = await env.DB.prepare("SELECT room, cap FROM room_caps").all();
    (c.results || []).forEach((r) => (roomCaps[r.room] = r.cap));
  } catch (_) {}

  return new Response(render(rows, todos, gameIdeas, roomCaps), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function chip(g) {
  const cap = g.is_captain ? " captain" : "";
  const crown = g.is_captain ? '<span class="crown">👑</span>' : "";
  return `<div class="chip${cap}" draggable="true" data-id="${g.id}">${crown}${esc(g.name)}</div>`;
}

function column(team, guests) {
  if (team === 0 || team === -1) {
    const np = team === -1;
    return `<div class="team-col pool${np ? " notplaying" : ""}" data-team="${np ? -1 : ""}">
      <h3>${np ? "🚫 Not Playing" : "Unassigned"} <span class="cnt">${guests.length}</span></h3>
      <div class="dropzone" data-role="members">${guests.map(chip).join("")}</div>
    </div>`;
  }
  const captain = guests.find((g) => g.is_captain);
  const members = guests.filter((g) => !g.is_captain);
  const full = guests.length >= CAP ? " full" : "";
  return `<div class="team-col${full}" data-team="${team}">
    <h3>Team ${team} <span class="cnt">${guests.length}/${CAP}</span></h3>
    <div class="cap-slot dropzone${captain ? " filled" : ""}" data-role="captain">
      ${captain ? chip(captain) : '<span class="cap-ph">👑 Captain</span>'}
    </div>
    <div class="dropzone members" data-role="members">${members.map(chip).join("")}</div>
  </div>`;
}

function listSection(opts) {
  const { icon, title, endpoint, items, placeholder, addLabel, openLabel } = opts;
  const rows = items
    .map(
      (t) => `<li class="todo${t.done ? " done" : ""}">
        <form method="post" action="${endpoint}">
          <input type="hidden" name="action" value="toggle" />
          <input type="hidden" name="id" value="${t.id}" />
          <button class="todo-check" title="${t.done ? "Mark as not done" : "Mark as done"}">${t.done ? "☑" : "☐"}</button>
        </form>
        <span class="todo-text">${esc(t.text)}</span>
        <form method="post" action="${endpoint}" onsubmit="return confirm('Delete this item?');">
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="id" value="${t.id}" />
          <button class="del" title="Delete">✕</button>
        </form>
      </li>`
    )
    .join("");
  const open = items.filter((t) => !t.done).length;
  return `<section class="card">
    <h2><span class="medal">${icon}</span> ${title} <span class="cnt">${open} ${openLabel}</span></h2>
    <form class="add-form" method="post" action="${endpoint}">
      <input type="hidden" name="action" value="add" />
      <input type="text" name="text" placeholder="${addLabel}" required />
      <button type="submit">+ Add</button>
    </form>
    <ul class="todo-list">${rows || `<li class="todo"><span class="todo-text">${placeholder}</span></li>`}</ul>
  </section>`;
}

const ST_ICON = { yes: "✅", none: "⏳", no: "❌" };

function rsvpState(r) {
  return r.coming === "yes" ? "yes" : r.coming === "no" ? "no" : "none";
}

function roomChip(r) {
  const st = rsvpState(r);
  return `<div class="chip rchip st-${st}" draggable="true" data-id="${r.id}" data-st="${st}"><span class="st">${ST_ICON[st]}</span>${esc(r.name)}</div>`;
}

function roomsSection(rows, caps) {
  const by = {};
  rows.forEach((r) => {
    const k = r.room && ROOMS.has(r.room) ? r.room : "";
    (by[k] = by[k] || []).push(r);
  });
  const counts = { yes: 0, none: 0, no: 0 };
  rows.forEach((r) => counts[rsvpState(r)]++);

  const pool = by[""] || [];
  const groups = [
    ["yes", "✅ Coming"],
    ["none", "⏳ No response yet"],
    ["no", "❌ Not coming"],
  ]
    .map(([st, label]) => {
      const list = pool.filter((r) => rsvpState(r) === st);
      return `<div class="pool-group pg-${st}"><h4>${label} <span class="pcnt">${list.length}</span></h4>
        <div class="dropzone rzone" data-room="" data-st="${st}">${list.map(roomChip).join("")}</div></div>`;
    })
    .join("");

  const bldgs = BUILDINGS.map((b) => {
    let used = 0;
    let total = 0;
    const rooms = b.rooms
      .map((rm) => {
        const cap = rm.kind === "bunk" && caps[rm.key] === 4 ? 4 : ROOM_CAP;
        const list = by[rm.key] || [];
        used += list.length;
        total += cap;
        const btn =
          rm.kind === "bunk"
            ? `<button type="button" class="cap-btn" data-room="${rm.key}" data-cap="${cap === 4 ? 2 : 4}">${cap === 4 ? "− Back to 2" : "+ Add 3rd &amp; 4th"}</button>`
            : "";
        return `<div class="room ${rm.kind}${list.length >= cap ? " full" : ""}" data-room="${rm.key}" data-cap="${cap}">
          <div class="room-head"><span class="room-name">${rm.kind === "bunk" ? "🛏️🛏️" : "🛏️"} ${esc(rm.label)}</span><span class="cnt">${list.length}/${cap}</span></div>
          <div class="dropzone rzone" data-room="${rm.key}">${list.map(roomChip).join("")}</div>${btn}
        </div>`;
      })
      .join("");
    return `<div class="bldg" data-bldg="${b.id}">
      <h3>🏠 ${esc(b.name)} <span class="cnt bcnt">${used}/${total}</span></h3>
      <div class="room-grid">${rooms}</div>
    </div>`;
  }).join("");

  return `<section class="card" id="rooms-card">
      <h2><span class="medal">🛏️</span> Room Assignments</h2>
      <p class="hint">Drag names into rooms (on your phone: press and hold, then drag). Up to ${ROOM_CAP} per room &mdash; bunk rooms can open a 3rd &amp; 4th spot. Drag a name back to <b>Unassigned</b> to take them out. Saves automatically.</p>
      <div class="legend">
        <span class="lg st-yes">✅ Coming <b>${counts.yes}</b></span>
        <span class="lg st-none">⏳ No response <b>${counts.none}</b></span>
        <span class="lg st-no">❌ Not coming <b>${counts.no}</b></span>
      </div>
      <div class="rooms" id="rooms">
        <div class="room-pool">
          <h3>Unassigned <span class="cnt pool-cnt">${pool.length}</span></h3>
          ${groups}
        </div>
        ${bldgs}
      </div>
      <p class="board-msg" id="rooms-msg" role="status" aria-live="polite"></p>
    </section>`;
}

function render(rows, todos, gameIdeas, roomCaps = {}) {
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
      const via = has && r.rsvp_by_name ? ' <span class="via">(via ' + esc(r.rsvp_by_name) + ")</span>" : "";
      const compete =
        !has || r.coming !== "yes" ? "—" : r.competing === "yes" ? "🏅 Yes" : "Spectating";
      const arrive = ARRIVE_LABEL[r.arrive] || "—";
      const depart = DEPART_LABEL[r.depart] || "—";
      let team = "—";
      if (r.team === -1) team = "Not playing";
      else if (r.team) team = `T${r.team}${r.is_captain ? " 👑" : ""}`;
      const when = esc((r.updated_at || "").replace("T", " ").slice(0, 16));

      const email = r.email
        ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`
        : "—";
      const phone = r.phone
        ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`
        : "—";

      return `<tr>
        <td>${esc(r.name)}</td>
        <td>${status}${via}</td>
        <td>${compete}</td>
        <td>${arrive}</td>
        <td>${depart}</td>
        <td>${team}</td>
        <td class="room-cell">${r.room && ROOMS.has(r.room) ? esc(ROOMS.get(r.room).building.replace("Building ", "B") + " · " + ROOMS.get(r.room).label) : "—"}</td>
        <td class="contact">${email}</td>
        <td class="contact">${phone}</td>
        <td>${esc(r.note) || ""}</td>
        <td>${esc(r.game_ideas) || ""}</td>
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
  const byTeam = { 0: [], "-1": [] };
  TEAMS.forEach((t) => (byTeam[t] = []));
  rows.forEach((r) => {
    let k;
    if (r.team === -1) k = "-1";
    else if (r.team && TEAMS.includes(r.team)) k = r.team;
    else k = 0;
    byTeam[k].push(r);
  });
  const board =
    column(0, byTeam[0]) +
    column(-1, byTeam["-1"]) +
    TEAMS.map((t) => column(t, byTeam[t])).join("");

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
    .via { color: #8aa0ad; font-size: 0.8rem; }
    .when { color: #8aa0ad; font-size: 0.8rem; white-space: nowrap; }
    .wrap-table { overflow-x: auto; }
    .add-form { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .add-form input { flex: 1 1 160px; }
    td.contact { font-size: 0.85rem; max-width: 180px; overflow-wrap: anywhere; }
    td.contact a { color: var(--ocean); text-decoration: none; }
    .add-form button { font-family: "Fredoka"; font-weight: 600; background: var(--ocean); color: #fff;
      border: none; border-radius: 0.8rem; padding: 0.6rem 1.2rem; cursor: pointer; }
    button.del { background: none; border: none; color: var(--coral); font-weight: 700; cursor: pointer; font-size: 1rem; }
    form { margin: 0; }

    /* Team board */
    .hint { color: #6a7f8c; margin-bottom: 1rem; font-size: 0.95rem; }
    .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.9rem; }
    .team-col { background: var(--sand); border-radius: 1rem; padding: 0.8rem; border: 2px solid transparent; min-height: 90px; }
    .team-col.pool { background: #eef6fb; grid-column: 1 / -1; }
    .team-col.notplaying { background: #f1eef4; }
    .team-col.notplaying h3 { color: #7a6b86; }
    .team-col h3 { font-size: 1rem; color: var(--ocean-deep); margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center; }
    .team-col .cnt { font-size: 0.85rem; font-weight: 700; color: var(--ocean); background: #fff; border-radius: 0.6rem; padding: 0.1rem 0.5rem; }
    .team-col.full .cnt { color: var(--coral); }
    .team-col.drag-over { border-color: var(--ocean); background: #dff1fb; }
    .team-col.full.drag-over { border-color: var(--coral); background: #ffe6e3; }
    .dropzone { display: flex; flex-wrap: wrap; gap: 0.4rem; min-height: 40px; }
    .pool .dropzone { min-height: 50px; }
    .cap-slot { border: 2px dashed #f0c84a; background: #fffaec; border-radius: 0.7rem; padding: 0.4rem;
      margin-bottom: 0.5rem; min-height: 42px; align-items: center; }
    .cap-slot.filled { border-style: solid; }
    .cap-ph { color: #b08a1e; font-size: 0.82rem; font-weight: 600; }
    .chip { background: #fff; border: 2px solid #d8e6ee; border-radius: 0.7rem; padding: 0.35rem 0.7rem;
      font-weight: 600; font-size: 0.9rem; cursor: grab; user-select: none; box-shadow: 0 2px 5px rgba(0,103,156,0.08);
      display: inline-flex; align-items: center; gap: 0.25rem; }
    .chip.captain { border-color: #f0c84a; background: #fff7e0; }
    .chip .crown { font-size: 0.85rem; }
    .chip:active { cursor: grabbing; }
    .chip.dragging { opacity: 0.4; }
    .chip { -webkit-touch-callout: none; -webkit-user-select: none; touch-action: manipulation; }
    .drag-ghost { position: fixed; left: 0; top: 0; z-index: 1000; pointer-events: none; opacity: 0.95;
      box-shadow: 0 10px 24px rgba(0,0,0,0.25); border-color: var(--ocean); }
    .board-msg { min-height: 1.2em; margin-top: 0.8rem; font-weight: 600; color: var(--coral); }
    h2 .cnt { font-size: 0.8rem; font-weight: 700; color: var(--ocean); background: var(--sand);
      border-radius: 0.6rem; padding: 0.15rem 0.6rem; }
    .todo-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .todo { display: flex; align-items: center; gap: 0.6rem; background: var(--sand);
      border-radius: 0.8rem; padding: 0.6rem 0.8rem; }
    .todo-text { flex: 1; font-weight: 500; }
    .todo.done .todo-text { text-decoration: line-through; color: #8aa0ad; }
    /* Room assignments */
    .legend { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .legend .lg { border-radius: 999px; padding: 0.3rem 0.8rem; font-weight: 600; font-size: 0.88rem; border: 2px solid; }
    .legend b { margin-left: 0.2rem; }
    .rooms { display: flex; flex-direction: column; gap: 1rem; }
    .room-pool { background: #eef6fb; border-radius: 1rem; padding: 0.8rem; }
    .room-pool h3, .bldg h3 { font-size: 1.05rem; color: var(--ocean-deep); margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center; }
    .room-pool .cnt, .bldg .cnt, .room .cnt { font-size: 0.82rem; font-weight: 700; color: var(--ocean); background: #fff; border-radius: 0.6rem; padding: 0.1rem 0.5rem; }
    .pool-group + .pool-group { margin-top: 0.6rem; }
    .pool-group h4 { font-size: 0.85rem; color: #5b6b76; margin-bottom: 0.35rem; display: flex; gap: 0.4rem; align-items: center; }
    .pool-group .pcnt { background: #fff; border-radius: 0.5rem; padding: 0 0.4rem; font-size: 0.78rem; }
    .bldg { background: var(--sand); border-radius: 1rem; padding: 0.8rem; border: 2px solid #f0e2c0; }
    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.6rem; }
    .room { background: #fff; border-radius: 0.8rem; padding: 0.55rem; border: 2px solid #e3eef4; display: flex; flex-direction: column; gap: 0.4rem; }
    .room.bunk { border-color: #d9cdf5; background: #fbf9ff; }
    .room.full .cnt { color: var(--coral); }
    .room.drag-over, .room:has(.drag-over) { border-color: var(--ocean); background: #dff1fb; }
    .room.full:has(.drag-over) { border-color: var(--coral); background: #ffe6e3; }
    .room-head { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; font-weight: 700; font-size: 0.88rem; }
    .room .dropzone { min-height: 38px; flex-direction: column; flex-wrap: nowrap; gap: 0.3rem; border-radius: 0.6rem; }
    .room .dropzone:empty { border: 2px dashed #d8e6ee; }
    .room-pool .dropzone { min-height: 36px; border-radius: 0.6rem; }
    .room-pool .dropzone:empty::before { content: "—"; color: #b0bec5; padding: 0.3rem; }
    .dropzone.drag-over { background: #dff1fb; }
    .cap-btn { align-self: flex-start; font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer;
      background: none; border: 1.5px dashed #8b7bc8; color: #5b4aa8; border-radius: 999px; padding: 0.15rem 0.6rem; }
    .cap-btn:disabled { opacity: 0.5; }
    .rchip .st { font-size: 0.8rem; }
    .st-yes { border-color: var(--green) !important; }
    .rchip.st-yes { background: #eafaf0; }
    .st-none { border-color: #c7d3db !important; color: #6a7f8c; }
    .rchip.st-none { border-style: dashed; }
    .st-no { border-color: #f0b4ad !important; color: #a0464f; }
    .rchip.st-no { background: #fdf1f0; text-decoration: line-through; text-decoration-thickness: 1.5px; }
    .legend .st-yes { background: #eafaf0; color: #137a3a; }
    .legend .st-none { background: #f3f6f8; }
    .legend .st-no { background: #fdf1f0; }
    .room-cell { white-space: nowrap; font-size: 0.85rem; }
    .todo-check { background: none; border: none; font-size: 1.25rem; cursor: pointer; line-height: 1; color: var(--ocean-deep); }
  </style>
</head>
<body>
  <main>
    ${listSection({ icon: "📝", title: "Things to Figure Out", endpoint: "/api/todos", items: todos, placeholder: "Nothing yet — add the first thing to sort out.", addLabel: "Add something to figure out…", openLabel: "open" })}

    ${listSection({ icon: "💡", title: "Game Ideas", endpoint: "/api/gameideas", items: gameIdeas, placeholder: "No ideas yet — drop the first game idea here.", addLabel: "Add a game idea…", openLabel: "to try" })}

    <section class="card">
      <h2><span class="medal">🏟️</span> Team Builder</h2>
      <p class="hint">Drag a name (on your phone: press and hold, then drag) into a team's roster, into the <b>👑 Captain</b> slot to make them captain, or into <b>🚫 Not Playing</b> for folks sitting out. Max ${CAP} per team (captain included). Saves automatically. (Teams are 1–8 for now; we'll make them countries later.)</p>
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
        <input type="email" name="email" placeholder="Email (optional)" />
        <input type="tel" name="phone" placeholder="Phone (optional)" />
        <button type="submit">+ Add guest</button>
      </form>
      <div class="wrap-table">
        <table>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Competing</th><th>Arrive</th><th>Leave</th><th>Team</th><th>Room</th><th>Email</th><th>Phone</th><th>Note</th><th>Game Ideas</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>${body || '<tr><td colspan="13">No guests yet — add some above.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    ${roomsSection(rows, roomCaps)}
  </main>

  <script>
    const CAP = ${CAP};
    const board = document.getElementById("board");
    const msg = document.getElementById("board-msg");
    const rooms = document.getElementById("rooms");
    const roomsMsg = document.getElementById("rooms-msg");
    const ROOTS = [board, rooms].filter(Boolean);
    let dragId = null;
    let dragEl = null;

    function setCaptain(chip, on) {
      chip.classList.toggle("captain", on);
      let crown = chip.querySelector(".crown");
      if (on && !crown) {
        crown = document.createElement("span");
        crown.className = "crown";
        crown.textContent = "👑";
        chip.prepend(crown);
      } else if (!on && crown) {
        crown.remove();
      }
    }

    function refresh() {
      board.querySelectorAll(".team-col").forEach((col) => {
        const isPool = col.classList.contains("pool");
        const n = col.querySelectorAll(".chip").length;
        col.querySelector(".cnt").textContent = isPool ? String(n) : n + "/" + CAP;
        if (!isPool) col.classList.toggle("full", n >= CAP);
        const cap = col.querySelector(".cap-slot");
        if (cap) {
          const hasChip = !!cap.querySelector(".chip");
          let ph = cap.querySelector(".cap-ph");
          if (hasChip && ph) ph.remove();
          if (!hasChip && !ph) {
            ph = document.createElement("span");
            ph.className = "cap-ph";
            ph.textContent = "👑 Captain";
            cap.appendChild(ph);
          }
          cap.classList.toggle("filled", hasChip);
        }
      });
    }

    ROOTS.forEach((root) => {
      root.addEventListener("dragstart", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        dragId = chip.dataset.id;
        dragEl = chip;
        chip.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", chip.dataset.id);
      });
      root.addEventListener("dragend", () => {
        if (dragEl) dragEl.classList.remove("dragging");
        dragId = null; dragEl = null;
        document.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
      });
    });

    document.querySelectorAll("#board .dropzone, #rooms .dropzone").forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        dropInto(zone);
      });
    });

    // Route a drop to the board the zone belongs to (names can't jump between boards).
    function dropInto(zone) {
      if (!dragEl) return Promise.resolve();
      const toRooms = !!zone.closest("#rooms");
      if (toRooms !== !!dragEl.closest("#rooms")) return Promise.resolve();
      return toRooms ? roomDrop(zone) : teamDrop(zone);
    }

    async function teamDrop(zone) {
      if (!dragEl) return;
      const chip = dragEl;
      const id = dragId;

      const col = zone.closest(".team-col");
      const t = col.dataset.team;
      const team = t === "" ? null : Number(t); // null=unassigned, -1=not playing, 1..8
      const isRealTeam = team !== null && team >= 1;
      const wantCaptain = zone.dataset.role === "captain" && isRealTeam;
      const fromCol = chip.closest(".team-col");
      const inThisTeam = fromCol === col;
      if (chip.parentNode === zone) return;

      if (isRealTeam && !inThisTeam && col.querySelectorAll(".chip").length >= CAP) {
        flash("Team " + team + " is full (" + CAP + " max)");
        return;
      }

      const prevParent = chip.parentNode;
      const prevCaptain = chip.classList.contains("captain");

      // Dropping into an occupied captain slot demotes the current captain.
      let demoted = null;
      if (wantCaptain) {
        const existing = zone.querySelector(".chip");
        if (existing && existing !== chip) {
          demoted = existing;
          col.querySelector(".dropzone.members").appendChild(existing);
          setCaptain(existing, false);
        }
      }

      zone.appendChild(chip);
      setCaptain(chip, wantCaptain);
      refresh();
      msg.textContent = "";

      try {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: Number(id), team, captain: wantCaptain }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      } catch (err) {
        prevParent.appendChild(chip);
        setCaptain(chip, prevCaptain);
        if (demoted) {
          col.querySelector(".cap-slot").appendChild(demoted);
          setCaptain(demoted, true);
        }
        refresh();
        flash(err.message || "Couldn't save — try again");
      }
    }

    // ---- Rooms ----
    function refreshRooms() {
      if (!rooms) return;
      rooms.querySelectorAll(".room").forEach((r) => {
        const n = r.querySelectorAll(".chip").length;
        const cap = Number(r.dataset.cap);
        r.querySelector(".cnt").textContent = n + "/" + cap;
        r.classList.toggle("full", n >= cap);
      });
      rooms.querySelectorAll(".bldg").forEach((b) => {
        let n = 0, cap = 0;
        b.querySelectorAll(".room").forEach((r) => { n += r.querySelectorAll(".chip").length; cap += Number(r.dataset.cap); });
        b.querySelector(".bcnt").textContent = n + "/" + cap;
      });
      rooms.querySelectorAll(".pool-group").forEach((g) => {
        g.querySelector(".pcnt").textContent = g.querySelectorAll(".chip").length;
      });
      rooms.querySelector(".pool-cnt").textContent = rooms.querySelectorAll(".room-pool .chip").length;
    }

    async function roomDrop(zone) {
      const chip = dragEl;
      if (!chip) return;
      const room = zone.dataset.room || null;
      // Back to Unassigned: file the name under its RSVP status group.
      const target = room ? zone : rooms.querySelector('.room-pool .dropzone[data-st="' + chip.dataset.st + '"]');
      if (!target || chip.parentNode === target) return;
      if (room) {
        const roomEl = zone.closest(".room");
        const cap = Number(roomEl.dataset.cap);
        if (zone.querySelectorAll(".chip").length >= cap) {
          flash(roomEl.querySelector(".room-name").textContent.trim() + " is full (" + cap + " max)", roomsMsg);
          return;
        }
      }
      const prevParent = chip.parentNode;
      target.appendChild(chip);
      refreshRooms();
      roomsMsg.textContent = "";
      try {
        const res = await fetch("/api/room", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: Number(chip.dataset.id), room: room }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      } catch (err) {
        prevParent.appendChild(chip);
        refreshRooms();
        flash(err.message || "Couldn't save — try again", roomsMsg);
      }
    }

    if (rooms) {
      rooms.addEventListener("click", async (e) => {
        const btn = e.target.closest(".cap-btn");
        if (!btn) return;
        const roomEl = btn.closest(".room");
        const cap = Number(btn.dataset.cap);
        btn.disabled = true;
        try {
          const res = await fetch("/api/room", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "cap", room: btn.dataset.room, cap: cap }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
          roomEl.dataset.cap = String(data.cap);
          btn.dataset.cap = data.cap === 4 ? "2" : "4";
          btn.textContent = data.cap === 4 ? "− Back to 2" : "+ Add 3rd & 4th";
          refreshRooms();
        } catch (err) {
          flash(err.message || "Couldn't save — try again", roomsMsg);
        } finally {
          btn.disabled = false;
        }
      });
    }

    // ---- Touch drag: press and hold a name, then drag it to a team or room ----
    const HOLD_MS = 220;
    let touch = null; // { chip, ghost, timer, startX, startY, active, x, y, zone }

    function zoneAt(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const z = el.closest(".dropzone");
      if (z) return z;
      // Anywhere on a room card counts as that room; anywhere on Unassigned counts as Unassigned.
      const room = el.closest(".room");
      if (room) return room.querySelector(".dropzone");
      const pool = el.closest(".room-pool");
      if (pool) return pool.querySelector(".dropzone");
      // Anywhere else on a team card counts as its roster.
      const col = el.closest(".team-col");
      return col ? col.querySelector(".dropzone.members") || col.querySelector(".dropzone") : null;
    }

    function startTouchDrag() {
      const t = touch;
      t.active = true;
      dragEl = t.chip;
      dragId = t.chip.dataset.id;
      t.chip.classList.add("dragging");
      const r = t.chip.getBoundingClientRect();
      const g = t.chip.cloneNode(true);
      g.className = t.chip.className.replace("dragging", "") + " drag-ghost";
      g.style.width = r.width + "px";
      document.body.appendChild(g);
      t.ghost = g;
      t.offX = r.width / 2;
      t.offY = r.height / 2;
      moveGhost(t.x, t.y);
      if (navigator.vibrate) navigator.vibrate(15);
    }

    function moveGhost(x, y) {
      const t = touch;
      t.ghost.style.transform = "translate(" + (x - t.offX) + "px," + (y - t.offY - 28) + "px)";
      const z = zoneAt(x, y);
      if (z !== t.zone) {
        if (t.zone) t.zone.classList.remove("drag-over");
        if (z) z.classList.add("drag-over");
        t.zone = z;
      }
    }

    let scrollRaf = null;
    function autoScroll() {
      if (!touch || !touch.active) { scrollRaf = null; return; }
      // Only auto-scroll once the finger has actually moved, so pressing a name near the edge doesn't scroll.
      if (!touch.moved) { scrollRaf = requestAnimationFrame(autoScroll); return; }
      const edge = 70, h = window.innerHeight;
      let dy = 0;
      if (touch.y < edge) dy = -Math.ceil((edge - touch.y) / 6);
      else if (touch.y > h - edge) dy = Math.ceil((touch.y - (h - edge)) / 6);
      if (dy) { window.scrollBy(0, dy); moveGhost(touch.x, touch.y); }
      scrollRaf = requestAnimationFrame(autoScroll);
    }

    function endTouch(drop) {
      const t = touch;
      if (!t) return;
      clearTimeout(t.timer);
      touch = null;
      if (!t.active) return;
      if (t.ghost) t.ghost.remove();
      if (t.zone) t.zone.classList.remove("drag-over");
      t.chip.classList.remove("dragging");
      if (drop && t.zone) dropInto(t.zone).finally(clearDrag);
      else clearDrag();
    }
    function clearDrag() { dragEl = null; dragId = null; }

    ROOTS.forEach((root) => root.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return; // mouse uses native drag & drop
      const chip = e.target.closest(".chip");
      if (!chip) return;
      touch = { chip, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, zone: null };
      touch.timer = setTimeout(() => { if (touch) { startTouchDrag(); autoScroll(); } }, HOLD_MS);
    }));

    document.addEventListener("pointermove", (e) => {
      if (!touch) return;
      touch.x = e.clientX; touch.y = e.clientY;
      if (!touch.active) {
        // Moved before the hold finished: treat it as a scroll, not a drag.
        if (Math.hypot(e.clientX - touch.startX, e.clientY - touch.startY) > 10) endTouch(false);
        return;
      }
      if (Math.hypot(e.clientX - touch.startX, e.clientY - touch.startY) > 20) touch.moved = true;
      moveGhost(e.clientX, e.clientY);
    });
    document.addEventListener("pointerup", () => endTouch(true));
    document.addEventListener("pointercancel", () => {
      // Browsers fire pointercancel when they start scrolling; keep the drag alive if it already began.
      if (touch && !touch.active) endTouch(false);
    });
    // Block page scrolling while a name is being dragged.
    document.addEventListener("touchmove", (e) => { if (touch && touch.active) e.preventDefault(); }, { passive: false });
    document.addEventListener("touchend", () => { if (touch && touch.active) endTouch(true); });
    ROOTS.forEach((root) => root.addEventListener("contextmenu", (e) => { if (e.target.closest(".chip")) e.preventDefault(); }));

    function flash(text, el) {
      el = el || msg;
      el.textContent = text;
      setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3000);
    }
  </script>
</body>
</html>`;
}
