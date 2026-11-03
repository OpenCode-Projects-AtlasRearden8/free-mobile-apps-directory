# Free Forever: Mobile Apps That Actually Stay Free

A static, plain-English directory of genuinely free mobile apps that *stay* free.
It covers note-takers, document scanners, sleep-sound apps, step counters,
budgeting helpers, and chess trainers. Every "card" tells you what the free tier
really includes, what it limits, and what the paid tier costs, plus permission
notes and a **verified-free-on** date with a scheduled **recheck** date.

This project is maintained by **Asdale Dynamics, LLC** as a practical,
beginner-friendly life-admin tool. It is built like everything we publish:
clear, warm, tested, and local-first.

## The editorial promise

- **Genuinely free** means the app's core purpose works on the free tier — not a
  three-day trial, not a crippled demo. Ads on a free tier are tolerated and
  noted honestly; paywalls that block the core purpose are not.
- **No ads, no paid placement, no affiliate links.** Apps are listed because the
  free tier holds up, full stop.
- **No personal data.** The site is static HTML. No analytics, no cookies, no
  accounts, no form inputs. Its only network call is fetching its own
  `data/apps.json`.
- **Link tests.** Every external link on every card is checked by
  `scripts/test.js`. Broken links are fixed or removed, never left rotting.
- **Recheck dates.** Each card must be re-verified on or before its `recheckOn`
  date. Overdue cards get a visible "needs recheck" badge on the site.

## What the site does

- Drives every app card from a single JSON file (`data/apps.json`).
- Filters by category, platform, and tag, with free-text search.
- Sorts by name, category, next recheck date, or verification date.
- Flags cards whose recheck date has passed (or is due within 14 days).

## How to run it

Any static file server works. From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(A server is needed rather than double-clicking `index.html`, because the page
fetches its JSON data over HTTP.)

## How to test it

The test suite has zero dependencies — it uses Node's built-in `http` and
`fetch`:

```bash
node scripts/test.js
```

It verifies:

1. The shared `AppLib` logic (date parsing, filtering, sorting, validation) via
   unit tests.
2. The **real** `data/apps.json`: schema, categories, dates, duplicate IDs,
   https-only links, no affiliate parameters.
3. Editorial policy: no email addresses in site files, all links unique and
   https.
4. Site-file sanity: index/CSS/JS assets exist and are linked, the exact MIT
   license line is present, and the README credits Asdale Dynamics, LLC.
5. A served-site smoke test: spins up a local server and checks the home page
   and every asset respond correctly (including a 404 path).
6. **Live link tests**: fetches every external URL on every card and fails on
   any 4xx/5xx.

All tests must pass before any commit.

## Repository layout

```
index.html          One static page: filters + card grid
assets/style.css    Styling (no frameworks)
assets/lib.js       Pure logic shared by the page and tests
assets/app.js       DOM rendering and filter wiring
data/apps.json      The app-card catalog (source of truth)
scripts/test.js     Unit + policy + smoke + live link tests
LICENSE             MIT — Copyright (c) 2026 Asdale Dynamics, LLC
```

## Adding or re-verifying a card

Open `data/apps.json`. Each card needs: `id`, `name`, `category`, `platforms`,
`summary`, `freeTier` (what free really includes), `limits`, `paid`, `ads`,
`permissions`, `privacyNote`, `links` (https only), `verifiedFreeOn`,
`recheckOn`, and `tags`. Run `node scripts/test.js` — the suite will not let a
malformed card, dead link, or missing date through.

Then bump `verifiedFreeOn` to today and set `recheckOn` roughly 90 days out.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Asdale Dynamics, LLC.

The app names and trademarks mentioned on the site belong to their respective
owners and are referenced for identification purposes only.
