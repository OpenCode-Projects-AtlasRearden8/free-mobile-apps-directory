# STATUS.md — Free Forever: Mobile Apps That Actually Stay Free

A static, plain-HTML directory of genuinely free mobile apps, driven by JSON data
cards, with filters, permission notes, verified-free-on dates, and scheduled
recheck dates. Built and maintained by Asdale Dynamics, LLC.

## What was built

- `index.html` — one static page (no frameworks, no build step, no analytics,
  no cookies, no forms). Hosts the filter bar and the app-card grid.
- `assets/style.css` — warm, plain styling.
- `assets/lib.js` — pure logic (date parsing/validation, category/platform/tag/
  keyword filtering, sorting, card-schema validation). Shared between the page
  and the tests.
- `assets/app.js` — DOM rendering: cards, filter controls, recheck banner,
  needs-recheck badges.
- `data/apps.json` — source of truth: 23 app cards across six categories
  (Note-takers, Scanners, Sleep sounds, Step counters, Budgeting, Chess
  trainers). Each card: what the free tier really includes, limits, what costs
  money, the ad situation, permission notes, privacy notes, https-only links,
  `verifiedFreeOn` date, and `recheckOn` date.
- `scripts/test.js` — zero-dependency test suite (Node built-ins only):
  unit tests, data validation, editorial-policy checks, a served-site smoke
  test, and **live link tests** against every external URL on every card.
- `README.md` — how it works, how to run and test, editorial promise.
- `LICENSE` — MIT. Copyright (c) 2026 Asdale Dynamics, LLC.

## How to run it

```bash
cd free-mobile-apps-directory
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works. `fetch()`ing `data/apps.json` requires HTTP (the
page explains this politely if opened via `file://`).

## How to test it

```bash
node scripts/test.js
```

## Verification results (last run: 2026-11-03, environment: Linux, Node v20.19.2)

- **59 checks passed / 0 failed.** Summary:
  - Unit tests on `AppLib`: date format parsing, https-only URL checks,
    overdue/due-soon logic, filtering by category/platform/tag/search,
    sorting (including recheck-date order and unknown-key fallback), and
    schema validation rejecting malformed cards (dup IDs, http links,
    recheck dates before verification dates).
  - Real data validation: all cards clean; all six required categories present.
  - Editorial policy: no email addresses in site files, all card links https,
    unique, and free of affiliate/tracking parameters.
  - Site files: LICENSE contains the exact line
    `Copyright (c) 2026 Asdale Dynamics, LLC`; README credits
    Asdale Dynamics, LLC; all referenced assets exist and return 200 from
    the local server; unknown paths 404 correctly.
  - Live link tests: **all 33 external URLs reachable** (HTTP < 400).
- During build, the link tests caught and led to fixes for: dead App
  Store/Play Store URLs and wrong package IDs, a retired app (Microsoft Lens —
  replaced with Google Drive's free built-in scanner), a dead product page
  (Adobe), and a drifted Oxford-type content card (myNoise app moved to a
  14-day-trial/one-time-purchase model — replaced by Insight Timer, whose
  free tier is verified non-trial).

## Known gaps and honest notes

- **App Store (Apple) links were removed from every card but one.** The
  environment this repo is built in cannot fetch `apps.apple.com` pages
  (geo/IP-level bot blocking manifests as endless 301 loops or 404s). Since
  the project's promise is "broken links get fixed or removed," untestable
  links were removed. The Play Store equivalents and official sites remain;
  links that *did* verify (e.g. Microsoft OneNote's App Store page) were kept.
- **UI interaction coverage is logic-level.** The filter/sort behavior is
  unit-tested via `AppLib` and the page is smoke-tested over HTTP, but there
  is no full browser/DOM interaction test (no headless-browser dependency is
  available). A manual filter pass in a browser is still worthwhile after
  changes.
- **Free-tier facts rot.** Every card carries a `recheckOn` date and the site
  visibly flags overdue cards, but no external service verifies free tiers
  automatically. The recheck workflow is a human ritual by design.
- Google's Play Console can drop listings per-country (Goodbudget had a
  temporary removal in 2025). The live link test will catch a full removal;
  country-specific removals would not be caught here.
- No site search beyond the client-side text filter (fine at 23 cards; would
  want real indexing past a few hundred).
