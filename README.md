# AUTOGRAFF

**A horizontal-first gallery and creative studio for street art and culture — "Share to Win."**
Upload work, give love, climb the board, and make beats in the browser.

🔗 **Live:** [www.aut0graff.com](https://www.aut0graff.com)

---

## What it is

AUTOGRAFF is a single-page web app — a "Netflix-meets-Art-Basel" gallery on the front,
a full **Web Audio beat + vocal studio** in the back. It runs on a lightweight
Vite/React front end with a handful of Vercel serverless functions backed by Upstash KV
and Vercel Blob. No login is required to browse, love, or make a beat.

The aesthetic is fixed and deliberate: **black & white, Impact / Helvetica, square corners,
one accent, lots of whitespace.** See [Design](#design-system).

---

## Features

| Tab | What it does |
| --- | --- |
| **GALLERY** | Curated, horizontally-scrolling showcase. Tap art to love it (heart burst), hold to open the creator. |
| **PHOTOS** | The community feed / contest — upload a photo or video, browse full-bleed cards, tap anywhere to send hearts. |
| **BOARD** | The leaderboard — Most Loved works and Top Supporters, across **Daily / Monthly / All-Time**. |
| **MEMBERS** | Member portfolios and tiers (Diamond / Platinum / Gold). |
| **STUDIO** | An FL-Studio-style beat maker — 14 synth voices, 16-step sequencer, 15 genre presets, live recording, vocals + voice FX, and vocal overdub layers. See [`docs/STUDIO.md`](docs/STUDIO.md). |
| **YOU** | Your profile and saved beats. |

Plus: a **waiting list** for the upcoming iOS app, share + referral tracking, and a
password-gated admin dashboard at `/admin.html`.

---

## Tech stack

- **Front end:** [Vite 5](https://vitejs.dev) + [React 18](https://react.dev) — plain JSX,
  inline styles (no CSS framework, no TypeScript). The whole app lives in
  `src/photo-contest-app.jsx`.
- **Audio:** the Web Audio API, hand-built — synthesis, scheduling, recording
  (`MediaRecorder`), and mic capture with effects. No audio libraries.
- **Back end:** [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node).
- **Data:** [Upstash for Redis](https://upstash.com) (KV) for the engagement ledger + photo
  metadata; [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) for uploaded media.
- **Planned:** [Supabase](https://supabase.com) for the hearts/credits economy (staged, see
  [`supabase/SETUP.md`](supabase/SETUP.md)) and [Resend](https://resend.com) for email.
- **Hosting:** Vercel, behind Cloudflare DNS.

---

## Project structure

```
autograff/
├── index.html                  # Root HTML — meta/OG tags, analytics, mounts the app
├── vite.config.js              # Vite config
├── vercel.json                 # Vercel function config
├── src/
│   ├── index.jsx               # React entry point
│   └── photo-contest-app.jsx   # The ENTIRE app — all pages & components, one file
├── api/                        # Vercel serverless functions
│   ├── likes.js                #   engagement ledger (hearts + shares, time-bucketed)
│   ├── photos.js               #   list uploaded photos
│   ├── upload.js               #   Vercel Blob client-upload handler
│   └── vip.js                  #   waiting-list signups
├── public/
│   ├── gallery/                # curated gallery artwork
│   ├── photos/                 # seed photos
│   ├── admin.html              # password-gated waiting-list dashboard
│   ├── robots.txt, sitemap.xml, llms.txt
│   └── *.png, og-image.jpg     # logos & social image
├── supabase/                   # hearts/credits economy — Stage 1, not yet live
│   ├── SETUP.md                #   how to provision & go live
│   ├── migrations/             #   full schema (RLS, ledger, atomic give_heart)
│   └── stage1-server/          #   server glue, staged out of the deploy path
└── docs/
    └── STUDIO.md               # complete Studio engine reference + vocal-loop guide
```

---

## Getting started

**Prerequisites:** Node 18+ and npm.

```bash
npm install        # install dependencies
npm run dev        # start the dev server → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

The front end runs fully without any backend — the API routes only power real likes,
uploads, and signups (they degrade gracefully when their env vars are absent).

---

## Environment variables

Set these in the Vercel project (and a local `.env` for testing). **Never commit values.**

| Variable | Purpose |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash KV — likes ledger + photo metadata |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — photo/video uploads |
| `ADMIN_KEY` | Unlocks the waiting-list admin dashboard / `GET /api/vip` |
| `SIGNUP_WEBHOOK_URL` | *(optional)* Slack/Discord ping on a new signup |

Future (see [`supabase/SETUP.md`](supabase/SETUP.md)): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and a Resend key.

---

## API routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/likes` | GET / POST | Engagement ledger — read counts (`?period=all\|daily\|monthly`), or post a like / share / presence ping |
| `/api/photos` | GET | Newest uploaded photos |
| `/api/upload` | POST | Vercel Blob client-upload handler (image/video, 25 MB max) |
| `/api/vip` | GET / POST | Waiting-list signups (GET requires `ADMIN_KEY`) |

---

## The Studio

The Studio is a complete beat + vocal workstation built on the Web Audio API: a 16-step
sequencer over 14 synthesized voices, 15 one-tap genre presets, full-mix recording, live
vocals with reverb / echo / robot / phone / auto-tune-character effects, and vocal overdub
layers synced to the beat.

**Full technical reference:** [`docs/STUDIO.md`](docs/STUDIO.md) — architecture, the audio
engine, synthesis, recording, vocals & FX, how to make vocal layers loop cleanly, iOS audio
notes, current limitations, and a roadmap.

---

## Backend & data

- **Live today:** the engagement ledger and media live in **Upstash KV** + **Vercel Blob**.
  Likes and shares are time-bucketed (daily / monthly / all-time) to drive the leaderboard.
- **Staged (not live):** a full **hearts / credits economy** on Supabase — 5 core tables,
  row-level security on everything, an append-only credit ledger, and an atomic `give_heart()`
  function. It's built and proven against an in-process Postgres but held back until
  provisioned. Setup: [`supabase/SETUP.md`](supabase/SETUP.md).

---

## Deployment

Deploys to **Vercel**. From the project directory:

```bash
vercel --prod
```

The production site is served at [www.aut0graff.com](https://www.aut0graff.com) (apex →
`www`), with DNS on Cloudflare (records kept DNS-only, never proxied).

---

## Documentation

- [`docs/STUDIO.md`](docs/STUDIO.md) — the Studio engine, in full.
- [`supabase/SETUP.md`](supabase/SETUP.md) — provisioning the hearts/credits backend.

---

## Design system

Non-negotiable house style:

- **Black & white** — `#000` backgrounds, white text, **one** accent (red `#e53935` for love,
  green `#3ad07a` for live/success).
- **Type:** Impact (`IMP`) for headers, Helvetica / Georgia for body.
- **Square corners** everywhere (no rounded cards), no gradients, no drop shadows, no emoji-as-UI.
- Generous whitespace; 200–300 ms ease-out motion; the art is the hero, never the chrome.

---

*Private project. All rights reserved.*
