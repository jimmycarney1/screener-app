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
      heading: "Sign in at the Check-In Table 🎽",
      sub: "Type your name exactly as it's on the invite.",
      label: "Your name",
      field: "name",
      type: "text",
      action: "/api/signin",
      button: "🎽 Head to the Field",
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
  <title>JIMPHIeld Day 🎽 — The Jimphi Bachhhhhh Party</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="JIMPHIeld Day" />
  <meta property="og:title" content="JIMPHIeld Day 🎽 — The Jimphi Bachhhhhh Party" />
  <meta property="og:description" content="You're invited! Get the details and RSVP inside." />
  <meta property="og:url" content="https://jimphilympics.com/" />
  <meta property="og:image" content="https://jimphilympics.com/og.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="JIMPHIeld Day — The Jimphi Bachhhhhh Party" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://jimphilympics.com/og.jpg" />
  <meta name="description" content="You're invited! Get the details and RSVP inside." />
  <link href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Rubik:wght@400;500;600;700;800&family=Permanent+Marker&display=swap" rel="stylesheet" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎽</text></svg>" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Rubik", system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 1.5rem; color: #1d2433;
      background: repeating-linear-gradient(90deg, #4a9a3f 0 70px, #418d37 70px 140px); }
    .brand { font-family: "Bowlby One", sans-serif; font-size: clamp(2rem, 9vw, 3rem); color: #fbfaf3; line-height: 1;
      text-shadow: 0 4px 0 #2c6b2a; margin-bottom: 1.25rem; text-align: center; }
    .brand span { color: #ffc93c; display: inline-block; transform: rotate(-3deg); }
    .gate { position: relative; max-width: 420px; width: 100%; text-align: center; border-radius: 6px;
      padding: 2.2rem 1.75rem 1.75rem; box-shadow: 0 14px 28px rgba(0,0,0,0.3);
      background: repeating-linear-gradient(180deg, #fffdf5 0 31px, #c9dcef 31px 32px); }
    .gate::before { content: ""; position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
      width: 120px; height: 34px; border-radius: 8px; background: linear-gradient(180deg, #eef1f4, #a9b1ba 55%, #7d8690);
      box-shadow: 0 3px 5px rgba(0,0,0,0.3); }
    h1 { font-family: "Bowlby One", sans-serif; font-weight: 400; font-size: 1.4rem; color: #d62f3c; line-height: 1.15; margin-bottom: 0.4rem; }
    p.sub { font-weight: 500; margin-bottom: 1.4rem; }
    label { display: block; text-align: left; font-weight: 800; margin-bottom: 0.35rem; }
    input { width: 100%; font: inherit; font-size: 1.05rem; padding: 0.55rem 0.2rem; border: none;
      border-bottom: 2.5px solid #1d2433; background: transparent; color: #1d2433; }
    input:focus { outline: none; border-color: #1f5fbf; }
    button { width: 100%; margin-top: 1.3rem; font-family: "Bowlby One", sans-serif; font-size: 1.1rem; color: #fff;
      background: #d62f3c; border: 3px solid #1d2433; border-radius: 14px; padding: 0.8rem 1.5rem;
      cursor: pointer; box-shadow: 0 6px 0 #1d2433; transition: transform .1s ease, box-shadow .1s ease; }
    button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 0 #1d2433; }
    button:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 2px 0 #1d2433; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .msg { min-height: 1.2em; margin-top: 0.8rem; font-weight: 700; color: #d62f3c; }
  </style>
</head>
<body>
  <p class="brand"><span>JIMPHI</span>eld Day</p>
  <main class="gate">
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
