// POST /api/unlock — verify the site password and set the unlock cookie.
// The cookie value is the SHA-256 of the password (validated by _middleware.js).

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const data = await request.json().catch(() => ({}));
  const password = (data && data.password ? data.password : "").toString();

  if (env.SITE_PASSWORD && password === env.SITE_PASSWORD) {
    const token = await sha256Hex(env.SITE_PASSWORD);
    return json({ ok: true }, 200, {
      "Set-Cookie": `jimphi_site=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
    });
  }
  return json({ ok: false, error: "Wrong password" }, 401);
}
