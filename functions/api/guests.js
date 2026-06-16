// POST /api/guests — add or remove a guest (admin only, HTTP Basic Auth).
// Used by simple HTML forms on /admin, so it redirects back there.

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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

function backToAdmin() {
  return new Response(null, { status: 303, headers: { Location: "/admin" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return unauthorized();

  const form = await request.formData();
  const action = form.get("action");

  if (action === "add") {
    const name = (form.get("name") || "").toString().trim().slice(0, 120);
    if (name) {
      await env.DB.prepare("INSERT INTO guests (name, name_key) VALUES (?, ?)")
        .bind(name, normalize(name))
        .run();
    }
  } else if (action === "delete") {
    const id = Number(form.get("id"));
    if (Number.isInteger(id)) {
      await env.DB.prepare("DELETE FROM guests WHERE id = ?").bind(id).run();
    }
  }
  return backToAdmin();
}
