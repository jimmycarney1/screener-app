// POST /api/signout — forget which guest this browser is signed in as.

export function onRequestPost() {
  const headers = new Headers({ "content-type": "application/json" });
  const gone = "Path=/; Secure; SameSite=Lax; Max-Age=0";
  headers.append("Set-Cookie", `jimphi_guest=; HttpOnly; ${gone}`);
  headers.append("Set-Cookie", `jimphi_guest_name=; ${gone}`);
  headers.append("Set-Cookie", `jimphi_site=; HttpOnly; ${gone}`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
