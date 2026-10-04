// Live API check against the real Skulytics API.
//
// Usage (token is read from the environment, never passed as an argument so it
// does not land in shell history or a process list):
//
//   SKULYTICS_TOKEN=... node tools/api-check.mjs
//
// Costs one /product + one /product/status request per SKU, plus one probe per
// candidate Reviews path. Trial quota is finite - do not put
// this on a loop or a watcher.

const BASE_URL = 'https://api.skulytics.io';

const SKUS = [
  '109355p535804',
  'KFX480LP',
  '31575',
  'B36CL80ENS',
  'PTD700LSZSS'
];

// Reviews is the one tab with no fixture, so its path was never verified.
// These are the plausible candidates, probed once each
// against a single known SKU. A 404 rules a path out; a 200 confirms one.
const REVIEW_CANDIDATES = [
  '/v3/e-commerce/product/reviews',
  '/v3/e-commerce/product/review',
  '/v3/e-commerce/product/ratings'
];

const token = process.env.SKULYTICS_TOKEN;
if (!token) {
  console.error('SKULYTICS_TOKEN is not set. Run:');
  console.error('  SKULYTICS_TOKEN=<token> node tools/api-check.mjs');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

async function call(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    const ms = Date.now() - started;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep raw */ }
    return { status: res.status, ms, json, raw: text.slice(0, 400) };
  } catch (err) {
    return { status: 0, ms: Date.now() - started, error: err.message };
  }
}

function describeProduct(json) {
  const items = json?.data;
  if (!Array.isArray(items) || items.length === 0) return 'no records';
  const p = items[0];
  const parts = [
    `${items.length} record(s)`,
    p.brand ? `brand=${p.brand}` : null,
    p.name ? `name=${String(p.name).slice(0, 48)}` : null,
    // upc must stay a string with its leading zero, or null
    p.upc !== undefined ? `upc=${JSON.stringify(p.upc)} (${typeof p.upc})` : null,
    p.date_modified ? `date_modified=${JSON.stringify(p.date_modified)}` : null
  ].filter(Boolean);
  return parts.join(', ');
}

function describeStatus(json) {
  const items = json?.data;
  if (!Array.isArray(items) || items.length === 0) return 'no records';
  const zips = [];
  for (const rec of items) {
    for (const market of rec.markets ?? []) {
      const c = market.country ?? {};
      for (const z of c.zipcodes ?? []) {
        zips.push(`${z.zipcode}:${z.status}${z.date_discontinued ? ` (disc ${z.date_discontinued})` : ''}`);
      }
    }
  }
  return zips.length ? `${zips.length} zipcode row(s) -> ${zips.join(' | ')}` : 'no zipcode rows';
}

console.log('=== Default lookup: /product + /product/status ===\n');

let authFailed = false;

for (const sku of SKUS) {
  const q = encodeURIComponent(sku);
  const [prod, stat] = await Promise.all([
    call(`/v3/e-commerce/product?sku=${q}&matching_rule=exact`),
    call(`/v3/e-commerce/product/status?sku=${q}`)
  ]);

  console.log(`SKU ${sku}`);
  console.log(`  /product        ${prod.status} (${prod.ms}ms)  ${prod.status === 200 ? describeProduct(prod.json) : prod.error ?? prod.raw}`);
  console.log(`  /product/status ${stat.status} (${stat.ms}ms)  ${stat.status === 200 ? describeStatus(stat.json) : stat.error ?? stat.raw}`);
  console.log('');

  if (prod.status === 401 || stat.status === 401) { authFailed = true; break; }
}

if (authFailed) {
  console.error('401 from the API - the token was rejected. Stopping before burning more quota.');
  process.exit(2);
}

console.log('=== Reviews endpoint probe (one SKU, unverified paths) ===\n');
for (const path of REVIEW_CANDIDATES) {
  const res = await call(`${path}?sku=${encodeURIComponent(SKUS[1])}`);
  const verdict = res.status === 200 ? 'EXISTS' : res.status === 404 ? 'not found' : `see status`;
  console.log(`  ${res.status}  ${path}  -> ${verdict}`);
}
console.log('\nDone.');
