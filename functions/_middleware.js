// Site-wide "front door" password gate.
// Gates HTML pages behind a shared password (SITE_PASSWORD secret).
// Static assets, the /api/* endpoints, and the separately-protected /admin
// page are exempt. Unlock state is kept in an HttpOnly cookie whose value is
// the SHA-256 of the password (the raw password is never stored client-side).

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const p = url.pathname;

  const exempt =
    p.startsWith("/api/") ||
    p === "/admin" ||
    p === "/admin.html" ||
    /\.(css|js|mjs|svg|png|jpe?g|ico|webp|gif|woff2?|ttf|map)$/i.test(p);
  if (exempt) return next();

  // Locked unless a valid unlock cookie is present.
  if (env.SITE_PASSWORD) {
    const cookie = request.headers.get("Cookie") || "";
    const m = cookie.match(/(?:^|;\s*)jimphi_site=([a-f0-9]+)/);
    if (m) {
      const expected = await sha256Hex(env.SITE_PASSWORD);
      if (m[1] === expected) return next();
    }
  }

  return new Response(loginPage(), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function loginPage() {
  return `<!DOCTYPE html>
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
    body {
      font-family: "Fredoka", system-ui, sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 1.5rem; color: #142a3a;
      background: linear-gradient(180deg, #7fd9e8 0%, #aee9f0 40%, #fff3da 100%);
    }
    .gate {
      background: #fff; border-radius: 1.5rem; padding: 2.5rem 2rem; max-width: 420px; width: 100%;
      text-align: center; box-shadow: 0 14px 40px rgba(0,103,156,0.22);
      border-top: 6px solid transparent;
      border-image: linear-gradient(90deg,#0085c7,#f4c300,#111,#009f3d,#df0024) 1;
    }
    .rings { margin-bottom: 1rem; }
    h1 { font-family: "Bungee", sans-serif; font-size: 1.5rem; color: #00679c; line-height: 1.1; margin-bottom: 0.4rem; }
    p.sub { font-weight: 500; margin-bottom: 1.5rem; }
    label { display: block; text-align: left; font-weight: 600; color: #00679c; margin-bottom: 0.4rem; }
    input {
      width: 100%; font-family: inherit; font-size: 1rem; padding: 0.8rem 1rem;
      border: 2px solid #d8e6ee; border-radius: 0.9rem; background: #fbfdff;
    }
    input:focus { outline: none; border-color: #0085c7; box-shadow: 0 0 0 3px rgba(0,133,199,0.15); }
    button {
      width: 100%; margin-top: 1.1rem; font-family: "Bungee", sans-serif; font-size: 1.05rem; color: #fff;
      background: linear-gradient(135deg,#df0024,#ff5a4d); border: none; border-radius: 1rem;
      padding: 0.9rem 1.5rem; cursor: pointer; box-shadow: 0 8px 20px rgba(223,0,36,0.3);
      transition: transform .15s ease;
    }
    button:hover:not(:disabled) { transform: translateY(-2px); }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .msg { min-height: 1.2em; margin-top: 0.8rem; font-weight: 600; color: #df0024; }
  </style>
</head>
<body>
  <main class="gate">
    <div class="rings">
      <svg viewBox="0 0 200 92" width="130" height="60" role="img" aria-label="Olympic rings">
        <g fill="none" stroke-width="6">
          <circle cx="35" cy="30" r="26" stroke="#0085C7"/>
          <circle cx="100" cy="30" r="26" stroke="#111111"/>
          <circle cx="165" cy="30" r="26" stroke="#DF0024"/>
          <circle cx="67" cy="60" r="26" stroke="#F4C300"/>
          <circle cx="132" cy="60" r="26" stroke="#009F3D"/>
        </g>
      </svg>
    </div>
    <h1>This party is invite&#8209;only 🔒</h1>
    <p class="sub">Enter the password to see the details.</p>
    <form id="unlock-form">
      <label for="pw">Password</label>
      <input type="password" id="pw" name="password" autocomplete="current-password" autofocus required />
      <button type="submit" id="btn">🔥 Enter the Games</button>
      <p class="msg" id="msg" role="status" aria-live="polite"></p>
    </form>
  </main>
  <script>
    const form = document.getElementById("unlock-form");
    const msg = document.getElementById("msg");
    const btn = document.getElementById("btn");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "";
      btn.disabled = true;
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: document.getElementById("pw").value }),
        });
        if (res.ok) { window.location.reload(); return; }
        msg.textContent = "Wrong password — try again!";
      } catch (_) {
        msg.textContent = "Something went wrong. Try again.";
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
