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

## Access / sign-in
Two gates, in order (both via `functions/_middleware.js`):
1. **Shared site password** (`SITE_PASSWORD` secret) — `/api/unlock`, sets `jimphi_site` cookie.
2. **Name sign-in** against the guest list — `/api/signin` matches the typed name
   (normalized) to a `guests` row and sets a signed `jimphi_guest` cookie. RSVPs are
   tied to that guest, so the form has no name field.

- **Admin** (`/admin`, `ADMIN_PASSWORD` secret, HTTP Basic Auth): manage the guest list
  (add/remove via `/api/guests`) and view the roster (invited / responded / coming /
  competing / arrive / leave).
- Guest list is seeded from `seed_guests.sql`. Duplicate first names (e.g. two "Ben"s)
  are allowed; sign-in attaches to a matching guest who hasn't RSVP'd yet.
- Secrets are encrypted Cloudflare secrets — never in the repo. Rotate with
  `wrangler pages secret put <NAME> --project-name jimphi-bach-party`.

## Notes
- The previous version was a static-only GitHub Pages site; this replaces it with a single Cloudflare app.

## TODO / future ideas
- **Food preferences on the RSVP** — dedicated field(s) for dietary needs / allergies, and
  (if catered) a per-person meal/protein pick. Schema add is non-destructive:
  `ALTER TABLE rsvps ADD COLUMN diet TEXT;`
- **Food ordering** — let guests pre-order for the scheduled dinners
  (Friday: hibachi 🥢 · Saturday: pizza 🍕), tallied in the admin view.
- **Old GitHub Pages site** — decide whether to redirect `jimmycarney1.github.io/screener-app`
  to the Cloudflare site or retire it.
- **Custom domain** instead of `*.pages.dev`.
