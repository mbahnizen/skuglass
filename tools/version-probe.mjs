// Cross-version probe: calls the v1, v2 and v3 Skulytics endpoints for each
// SKU, saves every raw response, and prints the key fields side by side so
// differences between versions are visible.
//
// Usage (token is read from the environment, never passed as an argument):
//
//   SKULYTICS_TOKEN=... node tools/version-probe.mjs [SKU ...]
//
// PowerShell:
//
//   $env:SKULYTICS_TOKEN = '...'; node tools/version-probe.mjs
//
// Cost: ENDPOINTS.length requests per SKU (10), run sequentially per SKU.
// Raw responses are written to probe-output/<timestamp>/, which is gitignored:
// it is Skulytics data and must not be committed.

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://api.skulytics.io';

const DEFAULT_SKUS = [
  'JVW5301SJSS', // the SKU used in the v1 and v3 docs examples
  '109355P535804',
  'KFX480LP',
  '31575',
  'B36CL80ENS',
  'PTD700LSZSS',
  'AEL361DFIVY', // discontinued with a replacement in the v1 docs example
  '7008121491020' // mattress, the v2 docs example
];

const ENDPOINTS = [
  { key: 'v1-product', path: '/product', extra: '' },
  { key: 'v1-status', path: '/product/status', extra: '' },
  { key: 'v1-price', path: '/product/price', extra: '' },
  { key: 'v2-product', path: '/v2/e-commerce/product', extra: '' },
  { key: 'v2-rebates', path: '/v2/e-commerce/product/rebates/by-sku', extra: '' },
  { key: 'v3-product', path: '/v3/e-commerce/product', extra: '&matching_rule=exact' },
  { key: 'v3-status', path: '/v3/e-commerce/product/status', extra: '' },
  { key: 'v3-price', path: '/v3/e-commerce/product/price', extra: '' },
  { key: 'v3-rebates', path: '/v3/e-commerce/product/rebates', extra: '' },
  { key: 'v3-reviews', path: '/v3/e-commerce/product-reviews', extra: '' }
];

const token = process.env.SKULYTICS_TOKEN;
if (!token) {
  console.error('SKULYTICS_TOKEN is not set. Run:');
  console.error('  SKULYTICS_TOKEN=<token> node tools/version-probe.mjs [SKU ...]');
  process.exit(1);
}

const skus = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SKUS;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('probe-output', stamp);

async function call(urlPath) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${urlPath}`, { headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep raw text */ }
    return { status: res.status, ms: Date.now() - started, json, text };
  } catch (err) {
    return { status: 0, ms: Date.now() - started, json: null, text: String(err) };
  }
}

const first = r => (Array.isArray(r?.json?.data) ? r.json.data[0] : undefined);
const show = v => (v === undefined ? '-' : JSON.stringify(v));

function v3Zipcodes(r) {
  const rows = [];
  for (const rec of r?.json?.data ?? []) {
    for (const m of rec.markets ?? []) {
      for (const z of m.country?.zipcodes ?? []) rows.push(`${z.zipcode}:${z.status}`);
    }
  }
  return rows.length ? rows.join(' ') : undefined;
}

// One row per field; one column per version. Raw values, so type and format
// differences (string vs number, leading zeros, date padding) stay visible.
function fieldTable(r) {
  const p1 = first(r['v1-product']);
  const s1 = first(r['v1-status']);
  const pr1 = first(r['v1-price']);
  const p2 = first(r['v2-product']);
  const p3 = first(r['v3-product']);
  const pr3 = first(r['v3-price']);
  return [
    ['name', p1?.name, p2?.name, p3?.name],
    ['brand', p1?.brand?.brand_name, p2?.brand?.brand_name, p3?.brand?.brand_name],
    ['upc', p1?.upc, p2?.upc, p3?.upc],
    ['color', p1?.color, p2?.color, p3?.color?.brand_color],
    ['status', p1?.status ?? s1?.status, p2?.status, v3Zipcodes(r['v3-status'])],
    ['replaced_sku', s1?.replaced_sku ?? p1?.replaced_sku, p2?.replaced_sku, p3?.replaced_sku],
    ['msrp', pr1?.price?.msrp ?? p1?.price?.msrp, p2?.price?.msrp, pr3?.price?.manufacturer_price?.msrp?.price],
    ['map', pr1?.price?.map ?? p1?.price?.map, p2?.price?.map, pr3?.price?.manufacturer_price?.map?.price],
    ['date_modified', p1?.date_modified, p2?.date_modified, p3?.date_modified],
    ['category', p1?.category?.category_name, p2?.category?.category_name, p3?.category?.category_name]
  ];
}

fs.mkdirSync(outDir, { recursive: true });
const report = [`# Version probe ${stamp}`, ''];

for (const sku of skus) {
  const q = encodeURIComponent(sku);
  const results = {};
  for (const ep of ENDPOINTS) {
    const r = await call(`${ep.path}?sku=${q}${ep.extra}`);
    results[ep.key] = r;
    fs.mkdirSync(path.join(outDir, sku), { recursive: true });
    fs.writeFileSync(path.join(outDir, sku, `${ep.key}.json`), r.text);
    if (r.status === 401) {
      console.error(`401 on ${ep.key} - token rejected. Stopping.`);
      process.exit(2);
    }
  }

  const statuses = ENDPOINTS.map(ep => {
    const r = results[ep.key];
    const n = Array.isArray(r.json?.data) ? r.json.data.length : '-';
    return `${ep.key}=${r.status}/${n}`;
  }).join('  ');

  report.push(`## ${sku}`, '', `HTTP status / record count: ${statuses}`, '');
  report.push('| Field | v1 | v2 | v3 | Same? |', '|---|---|---|---|---|');
  for (const [field, a, b, c] of fieldTable(results)) {
    const vals = [a, b, c].filter(v => v !== undefined).map(v => JSON.stringify(v));
    const same = vals.length < 2 ? 'n/a' : new Set(vals).size === 1 ? 'yes' : 'NO';
    report.push(`| ${field} | ${show(a)} | ${show(b)} | ${show(c)} | ${same} |`);
  }
  report.push('');
  console.log(`${sku}: ${statuses}`);
}

fs.writeFileSync(path.join(outDir, 'summary.md'), report.join('\n'));
console.log(`\nRaw responses and summary written to ${outDir}`);
