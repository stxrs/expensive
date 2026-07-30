# Expensive — Private Expense Tracker

https://stxrs.github.io/expensive/

A self-hosted personal finance app: static frontend (HTML/CSS/vanilla JS) on
GitHub Pages, talking to your own PocketBase server over HTTPS.

## Architecture

Single-page app, hash-based routing (`#/dashboard`, `#/transactions`, …) so it
works correctly on GitHub Pages, including on refresh of a nested URL — there's
no server-side routing to break. ES modules, no build step, no framework.

```
User's browser
  → GitHub Pages (static frontend)
  → HTTPS
  → your self-hosted PocketBase (Nginx/Caddy reverse proxy + Let's Encrypt)
  → SQLite
```

```
index.html
css/style.css              design tokens (Night + Burgundy), layout, components, light/dark theme
js/
  config.js                 ← the ONE file to edit to point at your PocketBase
  utils.js                  money, dates/periods, calculations, DOM/toast/modal
  store.js                  tiny pub/sub state container
  dataLayer.js               wraps dataService + store so the UI never goes stale
  app.js                     router + shell wiring + auth bootstrap
  services/
    pocketbase.js             PocketBase-backed implementation
    index.js                  re-exports it as `dataService`
  views/
    auth.js, dashboard.js, transactions.js, budgets.js,
    categories.js, analytics.js, settings.js
manifest.webmanifest
```

Every view only talks to `dataService` from `services/index.js` — nothing else
in the app imports `services/pocketbase.js` directly. This app requires a
running PocketBase server to do anything; there's no offline/local fallback,
so set up PocketBase first (next section) before opening `index.html`.

## Setting up PocketBase

1. **Install PocketBase** on your server (the spare laptop is plenty — PocketBase
   is a single ~20MB binary + SQLite):
   ```bash
   ./pocketbase serve --http=127.0.0.1:8090
   ```
2. **Put it behind a reverse proxy with HTTPS** (Caddy example — it gets you
   Let's Encrypt automatically):
   ```
   expensive.yourdomain.com {
     reverse_proxy 127.0.0.1:8090
   }
   ```
   Never expose PocketBase directly to the internet without TLS in front of it,
   and don't open any other ports.
3. **Create the collections** below in the PocketBase admin UI (reachable only
   from your own network, or via an SSH tunnel — don't publish `/_/` publicly
   if you can avoid it).
4. **Edit `js/config.js`**:
   ```js
   POCKETBASE_URL: "https://expensive.yourdomain.com",
   ```
5. **Deploy the frontend to GitHub Pages** — push this folder to a repo and
   enable Pages on the branch/folder. No build step required.

## PocketBase schema

### `users` (built-in auth collection)
Default fields are enough (`email`, `password`). No custom fields required.

### `transactions`
| field | type |
|---|---|
| userId | relation → users (required) |
| type | select: expense, income |
| amount | number (integer, minor units e.g. paise/cents) |
| category | text |
| description | text |
| date | text (YYYY-MM-DD) |
| time | text (HH:MM) |
| paymentMethod | text |
| notes | text |
| tags | json (array of strings) |
| receiptFile | file (image, optional) |

### `categories`
userId (relation), name (text), type (select: expense/income), icon (text),
color (text), archived (bool)

### `budgets`
userId (relation), category (text, empty = overall budget), limit (number,
minor units), period (text, "monthly")

### `payment_methods`
userId (relation), name (text)

### `recurring`
userId (relation), type, amount, category, description, frequency (select:
daily/weekly/monthly/yearly), paymentMethod, startDate, endDate (optional),
lastRun (text, optional), paused (bool)

### `settings`
userId (relation), currency (text), theme (text), monthStartDay (number),
notifyBudgetWarnings (bool)

## Access rules (do this for every collection above)

Set **List/Search**, **View**, **Create**, **Update**, and **Delete** rules to:

```
userId = @request.auth.id
```

For **Create**, additionally lock the field so people can't write someone
else's `userId`:

```
@request.auth.id != "" && @request.data.userId = @request.auth.id
```

This is the real security boundary — the frontend's own filtering is only for
UX. Never rely on client-side filtering alone.

## Receipts

`views/transactions.js` keeps the real picked `File` object and only sends it
to `services/pocketbase.js` when it actually changes: a new file is uploaded
as `multipart/form-data` into the `receiptFile` field, removing an existing
receipt sends an explicit empty value to clear it, and leaving it untouched
sends nothing for that field at all. Editing a transaction previews the
receipt straight from your PocketBase file storage (`receiptUrl`, derived via
`pb.files.getUrl()`), not from a local copy.

## What's intentionally out of scope for a static frontend

These require server-side infrastructure and are documented rather than faked:

- **Scheduled push notifications** (budget alerts, recurring reminders) need a
  server-side cron/worker plus a push service — this build shows in-app
  notifications only, generated live in the browser.
- **Full database backup/restore** is an administrator operation against the
  PocketBase server/SQLite file directly (e.g. `pocketbase` admin commands or
  simple filesystem backups of `pb_data`) — never expose that over the public
  frontend. Per-user CSV/JSON export (built in, under Settings) is the
  user-facing equivalent.
- **PWA icons**: `manifest.webmanifest` is wired up but ships with no icon
  files — drop your own `192.png`/`512.png` into `assets/` and reference them
  in the manifest to make the app installable.

## Notable design decisions

- **Palette**: Night (`#151515`) and Burgundy (`#93032E`) are the two brand
  colors, defined once as CSS custom properties in `css/style.css` (`--bg`,
  `--brand`, …) and re-read at runtime by the chart code in `views/dashboard.js`
  and `views/analytics.js` — change a value in one place and both the UI and
  the charts follow. A muted gold (`--gold`) is used sparingly for "approaching
  budget limit" states, and a deep emerald (`--positive`) for income.
- **Money** is stored as integer minor units (paise/cents) everywhere, never
  floats, to avoid rounding bugs. `js/utils.js` is the only place that converts
  to/from display values.
- **Custom month-start day** (e.g. budgeting from the 5th instead of the 1st)
  is handled by one function, `getPeriodForDate()`, that every dashboard/
  budget/analytics calculation calls — no duplicated date math.
- **Category deletion** reassigns existing transactions to "Miscellaneous"
  rather than corrupting them.
- **Recurring transactions** track a `lastRun` date per rule so refreshing or
  reopening the app never creates duplicate entries.

## Testing checklist

Register → log in → add expense/income → edit → duplicate → delete → search →
filter (combined) → sort → create/edit/archive/delete a category → set an
overall + category budget → cross the warning/over-budget thresholds → change
the month-start day → add/pause a recurring transaction → upload/remove a
receipt → export CSV and JSON → change currency → toggle theme → resize to
320/375/768/1024px → tab through a form with keyboard only → reload mid-session.
