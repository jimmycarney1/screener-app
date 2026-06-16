# Jimphi Bachhhhhh Party 🏅

One Cloudflare Pages app that serves the invite **and** the RSVP backend.
**Myrtle Beach · April 21–25.**

- **Frontend** (static): `public/` — Olympic-themed invite + RSVP form, plus `public/admin.html` to view responses.
- **Backend** (serverless): `functions/api/rsvp.js` — `POST` records an RSVP, `GET` lists them.
- **Database**: Cloudflare **D1** (managed SQLite), schema in `schema.sql`, bound as `DB` in `wrangler.toml`.

## One-time deploy

Requires a Cloudflare account. Auth with either `wrangler login` (interactive)
or by exporting a token:

```bash
export CLOUDFLARE_API_TOKEN=<token with Pages:Edit + D1:Edit + account read>
export CLOUDFLARE_ACCOUNT_ID=<account id>

npm install

# 1. Create the SQLite (D1) database — copy the printed database_id
npm run db:create
#    paste it into wrangler.toml -> [[d1_databases]].database_id

# 2. Create the tables
npm run db:init

# 3. Deploy the Pages project (static assets + functions + D1 binding)
npm run deploy
```

You'll get a `https://jimphi-bach-party.pages.dev` URL. The RSVP form posts to
`/api/rsvp` on that same origin; `/admin.html` shows the roster.

## Local dev

```bash
npm run db:init:local   # seed a local SQLite copy
npm run dev             # serves public/ + functions at http://localhost:8788
```

## Notes
- The admin page is **unsecured for now** (password protection is a planned follow-up).
- The previous version was a static-only GitHub Pages site; this replaces it with a single Cloudflare app.
