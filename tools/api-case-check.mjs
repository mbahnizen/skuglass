// Does /product match SKUs case-sensitively?
//
// normalizeSkus() in lib/utils.js uppercases every SKU before it reaches the
// service worker, so the extension asks for "109355P535804" even when the user
// selected "109355p535804" on the page. If the API is case-sensitive that is a
// silent false negative on any lowercase SKU.
//
//   $env:SKULYTICS_TOKEN = '<token>'; node tools/api-case-check.mjs
//
// Costs 2 requests.

const BASE_URL = 'https://api.skulytics.io';
const AS_SELECTED = '109355p535804';   // as it appears in the wild
const AS_SENT = AS_SELECTED.toUpperCase(); // what the extension actually sends

const token = process.env.SKULYTICS_TOKEN;
if (!token) {
  console.error('SKULYTICS_TOKEN is not set.');
  process.exit(1);
}

async function lookup(sku) {
  const res = await fetch(
    `${BASE_URL}/v3/e-commerce/product?sku=${encodeURIComponent(sku)}&matching_rule=exact`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  const json = await res.json().catch(() => null);
  const items = Array.isArray(json?.data) ? json.data : [];
  return {
    status: res.status,
    count: items.length,
    sku: items[0]?.sku ?? null,
    name: items[0]?.name ? String(items[0].name).slice(0, 40) : null
  };
}

const asSelected = await lookup(AS_SELECTED);
const asSent = await lookup(AS_SENT);

console.log(`selected on page  "${AS_SELECTED}"  -> ${asSelected.status}, ${asSelected.count} record(s), sku=${JSON.stringify(asSelected.sku)}`);
console.log(`sent by extension "${AS_SENT}"  -> ${asSent.status}, ${asSent.count} record(s), sku=${JSON.stringify(asSent.sku)}`);
console.log('');

if (asSelected.count > 0 && asSent.count === 0) {
  console.log('VERDICT: case-sensitive. normalizeSkus() breaks lowercase SKUs - drop the toUpperCase().');
} else if (asSelected.count > 0 && asSent.count > 0) {
  console.log('VERDICT: case-insensitive. The uppercase normalisation is safe to keep.');
} else {
  console.log('VERDICT: inconclusive - neither form returned a record. Check the token and the SKU.');
}
