// Two-step "front door":
//   1. Shared site password (SITE_PASSWORD secret)  -> cookie jimphi_site
//   2. Name sign-in matching the guest list         -> cookie jimphi_guest (signed)
// Static assets, /api/*, and the separately-protected /admin are exempt.

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

function getCookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(
    new RegExp("(?:^|;\\s*)" + name + "=([^;]+)")
  );
  return m ? m[1] : null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const p = new URL(request.url).pathname;

  const exempt =
    p.startsWith("/api/") ||
    p === "/admin" ||
    p === "/admin.html" ||
    /\.(css|js|mjs|svg|png|jpe?g|ico|webp|gif|woff2?|ttf|map)$/i.test(p);
  if (exempt) return next();

  // Gate 1 — shared site password
  let passOk = false;
  if (env.SITE_PASSWORD) {
    const c = getCookie(request, "jimphi_site");
    if (c && c === (await sha256Hex(env.SITE_PASSWORD))) passOk = true;
  }
  if (!passOk) {
    return page({
      heading: "This party is invite&#8209;only 🔒",
      sub: "Enter the password to continue.",
      label: "Password",
      field: "password",
      type: "password",
      action: "/api/unlock",
      button: "🔓 Continue",
      error: "Wrong password — try again!",
    });
  }

  // Gate 2 — name sign-in against the guest list
  let guestOk = false;
  if (env.SITE_PASSWORD) {
    const c = getCookie(request, "jimphi_guest");
    if (c && c.includes(".")) {
      const [id, sig] = c.split(".");
      if (/^\d+$/.test(id) && sig === (await hmacHex(env.SITE_PASSWORD, "guest:" + id))) {
        guestOk = true;
      }
    }
  }
  if (!guestOk) {
    return page({
      heading: "Sign in to the Games 🏅",
      sub: "Type your name exactly as it's on the invite.",
      label: "Your name",
      field: "name",
      type: "text",
      action: "/api/signin",
      button: "🔥 Enter the Games",
      error: "We couldn't find that name on the guest list — check the spelling or ask Jimmy & Phi.",
    });
  }

  return next();
}

function page(o) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Jimphi Bachhhhhh Party 🔒</title>
  <link href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏅</text></svg>" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Fredoka", system-ui, sans-serif; min-height: 100vh; display: flex;
      align-items: center; justify-content: center; padding: 1.5rem; color: #142a3a;
      background: linear-gradient(180deg, #7fd9e8 0%, #aee9f0 40%, #fff3da 100%); }
    .gate { background: #fff; border-radius: 1.5rem; padding: 2.5rem 2rem; max-width: 420px; width: 100%;
      text-align: center; box-shadow: 0 14px 40px rgba(0,103,156,0.22); border-top: 6px solid transparent;
      border-image: linear-gradient(90deg,#0085c7,#f4c300,#111,#009f3d,#df0024) 1; }
    h1 { font-family: "Bungee", sans-serif; font-size: 1.45rem; color: #00679c; line-height: 1.15; margin-bottom: 0.4rem; }
    p.sub { font-weight: 500; margin-bottom: 1.5rem; }
    label { display: block; text-align: left; font-weight: 600; color: #00679c; margin-bottom: 0.4rem; }
    input { width: 100%; font-family: inherit; font-size: 1rem; padding: 0.8rem 1rem; border: 2px solid #d8e6ee;
      border-radius: 0.9rem; background: #fbfdff; }
    input:focus { outline: none; border-color: #0085c7; box-shadow: 0 0 0 3px rgba(0,133,199,0.15); }
    button { width: 100%; margin-top: 1.1rem; font-family: "Bungee", sans-serif; font-size: 1.05rem; color: #fff;
      background: linear-gradient(135deg,#df0024,#ff5a4d); border: none; border-radius: 1rem; padding: 0.9rem 1.5rem;
      cursor: pointer; box-shadow: 0 8px 20px rgba(223,0,36,0.3); transition: transform .15s ease; }
    button:hover:not(:disabled) { transform: translateY(-2px); }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .msg { min-height: 1.2em; margin-top: 0.8rem; font-weight: 600; color: #df0024; }
    .rings { margin-bottom: 1rem; }
  </style>
</head>
<body>
  <main class="gate">
    <div class="rings">
      <svg viewBox="0 0 200 92" width="130" height="60" role="img" aria-label="Olympic rings">
        <g fill="none" stroke-width="6">
          <circle cx="35" cy="30" r="26" stroke="#0085C7"/><circle cx="100" cy="30" r="26" stroke="#111111"/>
          <circle cx="165" cy="30" r="26" stroke="#DF0024"/><circle cx="67" cy="60" r="26" stroke="#F4C300"/>
          <circle cx="132" cy="60" r="26" stroke="#009F3D"/>
        </g>
      </svg>
    </div>
    <h1>${o.heading}</h1>
    <p class="sub">${o.sub}</p>
    <form id="f">
      <label for="v">${o.label}</label>
      <input type="${o.type}" id="v" name="${o.field}" autocomplete="${o.type === "password" ? "current-password" : "name"}" autofocus required />
      <button type="submit" id="b">${o.button}</button>
      <p class="msg" id="m" role="status" aria-live="polite"></p>
    </form>
  </main>
  <script>
    const f = document.getElementById("f"), m = document.getElementById("m"), b = document.getElementById("b");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); m.textContent = ""; b.disabled = true;
      try {
        const res = await fetch(${JSON.stringify(o.action)}, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ ${JSON.stringify(o.field)}: document.getElementById("v").value }),
        });
        if (res.ok) { window.location.reload(); return; }
        m.textContent = ${JSON.stringify(o.error)};
      } catch (_) { m.textContent = "Something went wrong. Try again."; }
      finally { b.disabled = false; }
    });
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
