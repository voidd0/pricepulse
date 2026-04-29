# pricepulse v1.0.0 — Stage 1 cheat-sheet (CWS / AMO / Edge + canon-aware)

Generated 2026-04-27. Read before writing one line of code.

## Locked product spec (option A — passive snapshot+diff monitoring)

**Audience**: SaaS founder / PM doing competitive pricing intel. NOT consumer (Honey-lawsuit territory, banned by portfolio rule). NOT live-overlay (DOM extraction is fragile across 50+ varied pricing pages).

**Core flow**:
1. User clicks the toolbar icon on any pricing page → "add to watchlist" → URL stored + initial snapshot captured server-side.
2. Backend Celery beat task periodically fetches each watchlist URL → hashes + stores text snapshot.
3. If text changes vs last snapshot → email alert via Resend with diff summary.
4. User opens the full app page → sees timeline graph per item + side-by-side diff viewer for any two snapshots.

**Tiers** (must verify via Paddle API at Stage 6 — see L5):
- **Free**: 5 watchlist entries, weekly checks (every 7d), 30d snapshot retention, email alerts only.
- **Pro $4.99/mo**: 50 entries, daily checks, unlimited retention, CSV export, AI tier-extraction unlimited (rate-limited 100/day).
- **Pro+ $12.99/mo**: 500 entries, hourly checks, Slack/Discord webhook alerts, JSON read-API access (key-scoped).

**Cost math** (per `feedback_economics_strict.md` ≥90% net margin):
- Server fetch: HTTP GET + sha256 hash. Free.
- AI tier-extraction (gemini-2.5-flash-lite, optional, only when user clicks "extract tiers"):
  - Input ~3K tokens, output ~500 tokens, ~$0.00018/call.
  - Pro daily cap 100/d → max $0.018/d × 30 = $0.54/mo cost / $4.99 rev = 89.2% margin.
  - Pro+ no daily cap but cost gated by hourly schedule — typical user 50 sites × 1 extract/d = 1500/mo × $0.00018 = $0.27/mo / $12.99 rev = 97.9% margin.
- Resend email: free under 3K/mo, then $0.001/email — alerts only on diff (rare event), <100/mo per user typical.
- Verdict: 89-98% margins across both Pro tiers. 🟢

---

## CWS (Chrome Web Store) field limits + reject classes

| Field | Limit | Notes |
|---|---|---|
| Extension name | 75 chars | Goes in manifest.name |
| Short description | **132 chars hard, target ≤105 for headroom** | Per locale, EVERY locale (`feedback_cws_description_132_chars.md`) |
| Detailed description | 16,000 chars | Don't list competitor brand names (`feedback_cws_brand_keyword_spam.md`) |
| Single-purpose statement | ≤1000 chars | Required dashboard field |
| Permission justification | ≤1000 chars per permission | Required for each permission declared |
| Privacy practices form | structured | Must declare data collection categories |
| Screenshots | 1280×800 PNG, 1-5 required | Real screenshots only, no stylized mocks (L2) |
| Promo tile | 440×280 (small), 920×680 (marquee) | Optional, Featured-only |

### Reject-class rules pricepulse must NOT trip

- ❌ **Keyword spam**: do NOT list "Stripe / HubSpot / Salesforce / Notion / Airtable / Slack / Webflow / Linear ..." in description. Generic phrasing only: "any SaaS pricing page", "competitor pricing pages you choose", "your watchlist of competitor pages".
- ❌ **`<all_urls>` host_permissions**: rejected. Use `activeTab` only — server-side fetching means the extension never reads page content beyond the URL the user is currently looking at when they click "add".
- ❌ **AI vendor names**: no "Gemini", "Claude", "GPT", "OpenAI" in copy (L4).
- ❌ **Fake testimonials**: don't manufacture social proof. Skip the "social proof" section entirely until we have real users to quote.
- ❌ **Misleading claims**: "track unlimited prices" is fine if Pro+ allows 500 entries. "Track every SaaS in the world" is misleading.

### Locked short description (target ≤105 chars for translation headroom)

Draft: `"Track competitor pricing pages on your watchlist. Email alerts when prices or tiers change. Privacy by default."`
Length: 116 chars — under 132 cap, with headroom for German/French translations (typically +20%).

Alternative tighter draft: `"Watch competitor SaaS pricing pages. Get an email when something changes. No buy/avoid recs — just diffs."`
Length: 109 chars — better headroom.

**Pick at Stage 5 after landing copy locks in the voice.**

### Single-purpose statement

Draft: "Helps SaaS founders and product managers monitor competitor pricing pages by capturing snapshots on a user-defined schedule and alerting on changes."

### Permission justifications

- `storage` — Store the user's watchlist (URLs + alert preferences) and license key locally. Profile and settings live in chrome.storage.sync; license key in chrome.storage.local.
- `activeTab` — Read the current tab's URL only when the user clicks the "add to watchlist" button on the toolbar. We do not read tab content otherwise.
- `host_permissions` — None requested. All page fetching happens server-side from our backend; the extension itself never accesses third-party hosts.
- `remote code` — None. All JS bundled in the zip; no CDN-hosted helpers, no eval of remote strings.

---

## AMO (Firefox Add-ons) specifics

- Min Firefox version: **140.0** (required for `data_collection_permissions` field, mandatory 2026+).
- Submission requires source-zip if any code is concatenated/minified (build.sh concatenates SW → must include source-zip).
- `data_collection_permissions` must declare:
  - `required: ["websiteContent"]` — we send the URL (the user's chosen pricing page) to our server. URL is technically "content of a web request".
  - `optional: ["technicalAndInteraction"]` — for future minimal anonymous error-rate telemetry.
  - **NOT required**: `personallyIdentifyingInfo` — we don't collect name/email/phone unless they sign up for Pro alerts (handled by Paddle, not the extension).
- Summary ≤250 chars, brand-free.
- Categories: Productivity → Web Development, with tag `competitor-monitoring`, `pricing`, `saas-tools`.

---

## Edge Add-ons specifics

- Short description sourced from manifest.description (no separate field).
- Detailed description must include the Edge-specific privacy clause: "for users running pricepulse in the Microsoft Edge browser, all clauses below apply identically."
- Search terms: ≤7 phrases × 30 chars, ≤21 words total. **NO brand names.** Draft: `competitor pricing` | `saas pricing tracker` | `pricing watchlist` | `price change alert` | `pricing intel` | `competitive intel` | `pricing snapshots` (14 words total).
- Edge policy 1.1.2: do NOT mention other browsers in listing copy.

---

## Architecture notes (tells Stage 2 what to build)

### Extension surfaces

1. **Popup** (toolbar click, 360px wide, ~520px tall):
   - Status badge: FREE / PRO / PRO+ + watchlist count (e.g. "3 / 5" or "47 / 50")
   - Big primary action: "+ add this page" (only enabled if current tab URL looks like a pricing page — heuristic: URL contains `/pricing` OR `/plans` OR page title contains "Pricing"/"Plans")
   - Recent alerts feed (last 5)
   - Footer: "open my watchlist" (deep-links to full app)

2. **Options page**:
   - Watchlist editor: table of URL / nickname / schedule / last-snapshot-at / actions (delete / view history)
   - Settings: alert email, Slack/Discord webhook URL (Pro+), CSV export button (Pro)
   - License key entry

3. **Full app page** (3 tabs):
   - **Watchlist**: table view, sortable
   - **Diff viewer**: pick item from dropdown → side-by-side highlighted diff between any two snapshots, with timeline scrubber
   - **History**: per-item timeline graph (Y axis = significant-change events; not a price line because pages have multi-tier pricing)

4. **Welcome page** (first-run only): consent panel + tier comparison + how-it-works flow

### Backend (lives in scrb FastAPI, new file `app/api/ext_pricepulse.py`)

- `POST /api/v1/ext/pricepulse/watchlist` — add entry (X-Install-Id for Free, X-License-Key for Pro)
- `GET /api/v1/ext/pricepulse/watchlist` — list user's items
- `PATCH /api/v1/ext/pricepulse/watchlist/{id}` — update nickname/schedule
- `DELETE /api/v1/ext/pricepulse/watchlist/{id}` — remove
- `GET /api/v1/ext/pricepulse/snapshots/{watchlist_id}` — paginated snapshot history
- `GET /api/v1/ext/pricepulse/diff/{snap_a}/{snap_b}` — text-diff between two snapshots
- `POST /api/v1/ext/pricepulse/extract-tiers` — AI-extract pricing tiers from a single URL (rate-limited)
- Internal: Celery beat task `pricepulse_check_watchlists` runs every hour, dispatches per-tier-frequency checks.

### DB schema (new tables in scrb_db, all UUID PKs)

- `pricepulse_watchlist`: id, owner_install_id (nullable), owner_license_key (nullable), url, nickname, schedule_seconds, created_at, last_checked_at, last_snapshot_id (FK)
- `pricepulse_snapshot`: id, watchlist_id (FK), captured_at, http_status, content_hash, content_text (extracted price-relevant text only — see L8 below), tiers_json (nullable, populated only if AI extract was triggered), diff_summary (nullable, computed at snapshot-creation if previous exists)
- `pricepulse_alert`: id, watchlist_id (FK), snapshot_id (FK), kind (email | slack | discord), sent_at, status

### Storage discipline (per `feedback_no_db_dump_to_public.md`)

- Snapshot text is stored — but **never** publish text to `/var/www/voiddo.com/drops/` or any public path. Internal admin only.
- Schema/counts/IDs in tool-results only. Visual diff inspection happens in the user's own app page authenticated by license-key or install-id.

---

## Anti-pitfall checklist (canon L1-L8 mapped to pricepulse)

| Lesson | Specific application |
|---|---|
| **L1 — icon transparent rounded** | Wait for user to send icon. Then run TRIM=56 + 18% radius + alpha=0 + pngquant. |
| **L2 — real screenshots, no mocks** | After Stage 2 code is loadable, run capture-screenshots.cjs on popup / options / app(watchlist) / app(diff) / app(history) / welcome. Produce 6 PNGs at 1280×800 (popup at 380×600). DO NOT build landing with `<div class="frame popup">` placeholders. |
| **L3 — brand spam audit** | Pre-commit to generic phrasing: "competitor pricing pages", "your watchlist", "any SaaS you choose". The brand list to avoid: Stripe / HubSpot / Salesforce / Notion / Airtable / Slack / Webflow / Linear / Intercom / Mailchimp / Asana / Monday / Zapier / ClickUp. Audit grep before Stage 8. |
| **L4 — no AI vendor names** | Marketing copy says "AI tier extraction" / "structured AI output" / "AI-assisted summary" — never "Gemini" / "Claude". Backend code calls `gemini-2.5-flash-lite` (technical fact, not user-facing). |
| **L5 — Paddle price-API verify** | Before Stage 6 writes any `$X.XX` into copy, run `curl api.paddle.com/prices/<id>` and use exact cents-to-dollars. No rounding. |
| **L6 — source-zip from build.sh** | build.sh `--zip` produces all 4 zips including source.zip from day 1. |
| **L7 — pre-Stage-8 audit gate** | Run the audit script BEFORE `index.html` generation. Block on any non-zero hit. |
| **L8 — drop token rotation** | Single token at first ship. Any rebuild → new token. Update memory's "when user asks" handoff. |

---

## Stage-3 icon ask (for the user)

Vision (1-2 sentences for user to brief their icon-gen prompt):
> «иконка pricepulse — neon-synthwave waveform / pulse line over dark backdrop, edge-glow accent в палитре violet→cyan; в центре thin минималистичный символ "$" или восходящая стрелка. Стиль consistent с jobmeta — same dark mood, same neon-glow, чтобы portfolio выглядел как коллекция, не как зоопарк. 1024×1024, square, pulsing/heartbeat vibe чтоб передать «monitoring».»

After user delivers PNG → Stage 3 transform per L1 → 5 sizes deployed.
