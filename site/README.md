# Jimphi Bachhhhhh Party 🏖️

A standalone static one-page site for the bachelor party.
**Myrtle Beach · April 21–25.**

Files:
- `index.html` — the page
- `styles.css` — styling

## Deploy to Cloudflare Pages

This is a plain static site (no build step). Deploy the contents of this folder.

### Option A — Wrangler (CLI)
```bash
# from this folder
export CLOUDFLARE_API_TOKEN=<your-token>   # token with "Cloudflare Pages: Edit"
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
npx wrangler pages deploy . --project-name=jimphi-bach-party
```

### Option B — Cloudflare dashboard (no CLI)
1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages**.
2. Choose **Upload assets** (or connect this Git repo, build dir = `site`).
3. Upload `index.html` and `styles.css`.
4. Deploy — you'll get a `*.pages.dev` URL.
