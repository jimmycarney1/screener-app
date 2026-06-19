// POST /api/todos — manage the admin "things to figure out" list (admin only).
// Form actions: add (text), toggle (id), delete (id). Redirects back to /admin.

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
    const text = (form.get("text") || "").toString().trim().slice(0, 300);
    if (text) {
      await env.DB.prepare("INSERT INTO todos (text) VALUES (?)").bind(text).run();
    }
  } else if (action === "toggle") {
    const id = Number(form.get("id"));
    if (Number.isInteger(id)) {
      await env.DB.prepare("UPDATE todos SET done = 1 - done WHERE id = ?").bind(id).run();
    }
  } else if (action === "delete") {
    const id = Number(form.get("id"));
    if (Number.isInteger(id)) {
      await env.DB.prepare("DELETE FROM todos WHERE id = ?").bind(id).run();
    }
  }
  return backToAdmin();
}
