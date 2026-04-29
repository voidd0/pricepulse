# pricepulse

[![License: MIT](https://img.shields.io/badge/license-MIT-A0573A.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-1F1A14)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Built by vøiddo](https://img.shields.io/badge/built%20by-v%C3%B8iddo-1F1A14)](https://voiddo.com/)

> competitor pricing pages on a watchlist. weekly / daily / hourly checks. email when something changes.

A browser extension for Chrome, Firefox, and Edge. Manifest V3. Live: [extensions.voiddo.com/pricepulse/](https://extensions.voiddo.com/pricepulse/).

## Why pricepulse exists

SaaS pricing pages are theatre. The headline number is the same for two years; the real changes are in the small print: a feature got moved from Pro to Enterprise, a tier got renamed, the "starts at $X" caveat changed from `per seat` to `per workspace`. By the time you notice these on a manual re-check, you've already missed three months of context.

pricepulse watches the pricing page in the background and emails you the diff. You stay in your editor; the change comes to you.

## What it does

Add a pricing page to your watchlist with one click. pricepulse fetches it on schedule (weekly / daily / hourly) and emails you when:

- a price changes (tier or seat or workspace)
- a tier name changes
- a feature is added, removed, or moved between tiers
- the page returns 4xx / 5xx (page taken down or restructured — itself a signal)

The diff arrives as a clean visual: old line struck through, new line in a contrast accent, with the URL and a one-paragraph AI-summarised explanation of what the change probably means for buyers.

## Pricing

- **Free tier** — 5 watched pages, weekly checks
- **Pro tier** — 50 pages, daily, with hourly bursts on demand. $4.99/mo or $34.99/yr.

Hard daily caps per account so a runaway watch on a JS-heavy page can't bill you.

## Compared to alternatives

We are not Visualping or Distill.io. Those are general-purpose visual page-change watchers. They will fire on any pixel that moved — including the lazy-loaded analytics widget and the rotating customer logo carousel. Most of the alerts they send are noise.

pricepulse only fires on **pricing-relevant** changes: tier names, prices, feature lines, button labels. We achieve this by parsing the page through a structured pricing-table extractor before diffing — most of the visual flicker filters out at that stage.

| feature | pricepulse | Visualping | Distill.io |
|---|---|---|---|
| Pricing-aware diffing | ✅ structured parser | ❌ pixel diff | ❌ DOM diff |
| AI summary of change | ✅ | ❌ | ❌ |
| Free tier | 5 pages, weekly | 5 pages, daily | 25 pages |
| Account required | yes (for emails) | yes | yes |
| Use case fit | competitor pricing | any page | any page |

If you watch one pricing page a week, the free tier of any of these three will work. If you watch ten competitors and want signal-not-noise, pricepulse is built for that case specifically.

## FAQ

**Why does the free tier ship with weekly only?** Because most SaaS pricing pages move quarterly at best. Hourly checking on a free tier would be wasteful and costly. If you genuinely need same-day alerts, that's the Pro use case — we charge real money for that, not nothing.

**What about Stripe / Paddle pages?** Both work. We've tested against `*.stripe.com/pricing` mockups and the public Paddle plan pages. Headless-rendered React pricing tables (Webflow / Framer) are the trickier surface — we use a JS-aware extractor for those.

**Does it scrape behind a login?** No. Only public pricing pages. If a competitor hides their pricing behind "contact sales", that's information in itself, but pricepulse won't try to defeat the gate.

**Is the AI summary actually useful?** Honest answer: usually yes, sometimes redundant. The summary is best when a feature got renamed in a way that changes its scope ("Premium Support" → "Priority Support" — different SLAs). For raw price changes, you don't need the summary.

**Why "pricepulse"?** Because pricing pages have a heartbeat — a slow one. If you put a stethoscope on a competitor's pricing page, most weeks you hear nothing. Then one quarter, the rhythm breaks.

## Install

- Chrome / Brave / Opera: *pending submission*
- Firefox / LibreWolf: *pending submission*
- Edge: *pending submission*

Sideload (now): see [DOCS-CHEATSHEET.md](DOCS-CHEATSHEET.md).

## Build

```bash
./build.sh             # build all 3 browsers
./build.sh --zip       # build + produce zips
```

Per-browser manifest in `manifests/<browser>.json`. Source in `src/` — no bundler, no minification, all JS human-readable.

## Privacy

URLs you add to your watchlist live on `scrb.voiddo.com/api/v1/ext/pricepulse/...` for scheduled fetching. We don't share your watchlist with anyone. We send diff emails to the address on your account. No third-party trackers.

## More from the studio

This is one extension out of many — see [`from-the-studio.md`](from-the-studio.md) for the full lineup of vøiddo products (free CLI tools, other extensions, the studio's flagship products and games).

## From the same studio

- **[@v0idd0/jsonyo](https://www.npmjs.com/package/@v0idd0/jsonyo)** — JSON swiss army knife, 18 commands, zero limits
- **[@v0idd0/envguard](https://www.npmjs.com/package/@v0idd0/envguard)** — stop shipping `.env` drift to staging
- **[@v0idd0/depcheck](https://www.npmjs.com/package/@v0idd0/depcheck)** — find unused dependencies in one command
- **[@v0idd0/gitstats](https://www.npmjs.com/package/@v0idd0/gitstats)** — git repo analytics, one command
- **[View all tools →](https://voiddo.com/tools/)**

## License

MIT. See [LICENSE](LICENSE).

---

Built by [vøiddo](https://voiddo.com/) — a small studio shipping AI-flavoured products, free dev tools, Chrome extensions and weird browser games.
