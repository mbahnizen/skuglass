# tools/

Developer checks. Not shipped in the extension — nothing under `sidepanel/`,
`background/`, `lib/` or `content/` imports from here.

- `run_checks.sh` — the full pass. Run it from the repo root:
  `bash tools/run_checks.sh`. It runs `node --check` on every source file,
  runs the unit tests, counts listeners, reports CSS classes used in JS that
  have no rule, and greps `sidepanel/` for any sign of the bearer token
  leaking out of the service worker.
- `test_runner.js` — unit tests for the pure helpers in `lib/`: HTML escaping,
  SKU normalisation, filter dedupe, and overall-status computation. These
  cover the data quirks listed in the main [README](../README.md#data-quirks),
  which are the parts most likely to regress silently.
- `api-check.mjs`, `api-case-check.mjs` — live checks against the real API.
  Each spends trial quota, so run them deliberately, once, never on a loop.

Tests import the code they test. Do not keep a second copy of live logic
(for example `endpointMap`) in a script: nothing would keep it in sync.
