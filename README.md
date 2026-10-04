# SkuGlass

A Chromium (Manifest V3) extension for looking up appliance SKUs against the
[Skulytics](https://skulytics.io) API from a browser side panel, with a
persistent, searchable lookup history.

> An independent, unofficial project. Not affiliated with, endorsed by, or
> supported by Skulytics. You need your own Skulytics API account and bearer
> token to use it.

## Why

The Skulytics web UI answers one lookup at a time and forgets it when the tab
closes. SkuGlass keeps every lookup: select a SKU on any page, right-click,
and the result opens in a side panel next to the work it came from, then
stays in history across browser restarts.

## Features

- **Two entry points** - right-click selected text ("Look up SKU in
  SkuGlass") or type one or more comma-separated SKUs into the panel.
- **Product card** - name, brand, three-level taxonomy, UPC with
  copy-to-clipboard, last-updated date, replacement chain
  (replaced / alternate / short SKU), colorway chips that re-run the lookup,
  related items, and deduplicated specification filters.
- **Per-zipcode availability** - status (`Active`, `Coming Soon`,
  `Discontinued`, `Inactive`) is reported per market. Two or more zipcodes
  render as a table, one row each; a single zipcode renders as a compact
  strip with the same fields. No records means *Unknown*, never *Inactive*.
- **Lazy detail tabs** - Pricing, Specifications, Assets, Documents,
  Features, Certifications and Rebates load only when clicked, then stay
  cached for the session.
- **History** - every lookup, found or not, is stored locally and is
  searchable by SKU, name or brand, pinnable and re-runnable.
- **Quota-aware** - a lookup costs exactly two requests, fired in parallel.
  Repeat lookups within 15 minutes are served from cache, and nothing is ever
  fetched without a direct user action: no polling, no prefetching.
- Light and dark themes; motion respects `prefers-reduced-motion`.

## Security model

The Skulytics bearer token is the only secret, and it has one home.

- Stored in `chrome.storage.local` and read **only** by the service worker.
  It is never passed to a content script, injected into a page, or placed in
  a URL.
- Every request to `api.skulytics.io` is made from the service worker. The
  content script only reads the current text selection.
- Permissions are the minimum the features need: `contextMenus`, `storage`,
  `sidePanel`, and host access to `https://api.skulytics.io/*` alone.
- A rejected token (HTTP 401) leads to an explicit "token rejected, enter it
  again" state rather than a raw error.

## Installation

SkuGlass is not published to the Chrome Web Store. Load it unpacked:

1. Clone this repository.
2. Open `chrome://extensions` (or the equivalent in Edge, Brave or another
   Chromium browser) and enable **Developer mode**.
3. Click **Load unpacked** and select the repository root.
4. Open the side panel from the toolbar icon and enter your Skulytics bearer
   token in Settings.

There is no build step: the extension runs from source.

## Project structure

```
background/service-worker.js   API calls, token custody, response cache, context menu
content/content.js             Reads the current text selection; nothing else
sidepanel/                     Side panel UI (HTML, CSS, JS, bundled Inter font)
lib/                           Pure helpers: date parsing, SKU normalisation, filters, status
fixtures/                      Synthetic API responses, one per endpoint, used as shape references
tools/                         Developer checks and live API probes (not shipped)
icons/                         Extension icons
```

## Development

Requires Node.js 18 or later for the checks; the extension itself has no
dependencies.

```bash
bash tools/run_checks.sh
```

This syntax-checks every source file, runs the unit tests in
`tools/test_runner.js`, flags CSS classes used in JavaScript without a rule,
and scans the side panel for any sign of the token leaking out of the service
worker. See [tools/README.md](tools/README.md) for the live API probes.

### Service worker lifecycle

MV3 service workers are stopped and restarted between events, so no
module-level variable is trusted to survive. Every handler re-reads the
token, cache and history from `chrome.storage.local`.

## Data quirks

The API has a few shapes that default parsing gets wrong. The code handles
each one explicitly:

| Field | Quirk | Handling |
|---|---|---|
| `upc` | String with a leading zero (`"084691814399"`), or `null` | Kept as a string end to end; never coerced to a number |
| `date_added`, `date_modified` | `M/D/YYYY h:mm AM\|PM`, not ISO 8601 | Explicit parser in `lib/date-parser.js`; `Date.parse` is never used |
| `filter[]` | Contains duplicate `{field, value}` pairs | Deduplicated before rendering |
| `zipcode` | A number, while SKUs are strings | Typed per field, not assumed uniform |
| `brand` | An object, sometimes absent | Absent brands render as unknown, never a guessed manufacturer |
| SKU | Matched case-insensitively; the API returns uppercase | Input is normalised to uppercase |

### Fixtures

`fixtures/` holds one sample response per endpoint, each preceded by the
`curl` request that produces it. The data is synthetic: SKUs, brand, names,
prices, UPC and URLs are fictional. The shapes, types, `null`s and quirks
above are faithful to the live API. Treat the fixtures as a shape reference,
not a contract: the live API can return values a single sample does not show,
such as `upc: null`.

## Roadmap

- CSV export of history.
- Pricing and inventory endpoints that need a separate Skulytics integration
  setup, if they become available on the account's plan.

## License

[MIT](LICENSE) © 2026 Nizen Iskandar. "Skulytics" is a trademark of its
owner and is used here only to describe what the extension connects to.
