import fs from 'node:fs';
import { normalizeSkus, escapeHtml, dedupeAndGroupFilters, computeOverallStatus } from '../lib/utils.js';
import { ALIASES, flattenRecord, compareVersions, filterRows } from '../lib/compare.js';

console.log('=== SkuGlass unit tests ===\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

// 1. escapeHtml tests
console.log('1. Testing escapeHtml:');
assert(escapeHtml(null) === '', 'null returns empty string');
assert(escapeHtml(undefined) === '', 'undefined returns empty string');
assert(escapeHtml(0) === '0', '0 returns string "0" instead of empty string');
assert(escapeHtml(false) === 'false', 'false returns string "false" instead of empty string');
assert(escapeHtml('<script>') === '&lt;script&gt;', 'escapes HTML angle brackets');
assert(escapeHtml('Brand "X" & "Y"') === 'Brand &quot;X&quot; &amp; &quot;Y&quot;', 'escapes quotes and ampersands');

// 2. normalizeSkus tests
console.log('\n2. Testing normalizeSkus:');
assert(JSON.stringify(normalizeSkus('  jvw5301sjss,   pvm9005sjss  ')) === JSON.stringify(['JVW5301SJSS', 'PVM9005SJSS']), 'normalizes whitespace, uppercase, comma split');
assert(JSON.stringify(normalizeSkus('   ')) === '[]', 'empty input returns empty array');

// 3. dedupeAndGroupFilters tests
console.log('\n3. Testing dedupeAndGroupFilters:');
const sampleFilters = [
  { field: 'Color', value: 'Stainless Steel' },
  { field: 'Color', value: 'Stainless Steel' },
  { field: 'Color', value: 'Black' },
  { field: 'Type', value: 'Range Hood' },
  { field: 'Type', value: null }
];
const grouped = dedupeAndGroupFilters(sampleFilters);
assert(grouped['Color'].length === 2, 'deduplicates duplicate filter values');
assert(grouped['Color'].includes('Stainless Steel') && grouped['Color'].includes('Black'), 'groups filters by field');
assert(grouped['Type'].length === 1, 'skips entries with a null value');

const fixtureText = fs.readFileSync(new URL('../fixtures/List Products.txt', import.meta.url), 'utf8');
const fixtureFilters = JSON.parse(fixtureText.slice(fixtureText.indexOf('{'))).data[0].filter;
assert(Object.keys(dedupeAndGroupFilters(fixtureFilters)).length > 0, 'groups the fixture filter[] (API key names)');

// 4. Imported Multi-Zipcode Status Logic Verification (from lib/utils.js)
console.log('\n4. Testing computeOverallStatus (imported from lib/utils.js):');

assert(computeOverallStatus([]) === 'Unknown', '0 zipcodes => "Unknown"');
assert(computeOverallStatus([{ zipcode: '63011', status: 'Active' }]) === 'Active', '1 zipcode => "Active"');
assert(computeOverallStatus([
  { zipcode: '63011', status: 'Active' },
  { zipcode: '63017', status: 'Active' }
]) === 'Active', '2 active zipcodes => "Active"');

const mixedResult = computeOverallStatus([
  { zipcode: '63011', status: 'Active' },
  { zipcode: '63017', status: 'Discontinued' },
  { zipcode: '63021', status: 'Coming Soon' }
]);
assert(mixedResult === 'Mixed (1/3 Active)', '3 mixed zipcodes => "Mixed (1/3 Active)"');

console.log('\n5. Testing flattenRecord:');
const leaves = flattenRecord({ brand: { brand_name: 'Example' }, relations: {
  color_relation: [{ sku: 'A' }, { sku: 'B' }]
}, nil: null, emptyArray: [], emptyObject: {}, zero: 0, flag: false, text: '', unknown: undefined });
assert(JSON.stringify(leaves) === JSON.stringify([
  ['brand.brand_name', 'Example'], ['relations.color_relation[0].sku', 'A'],
  ['relations.color_relation[1].sku', 'B'], ['nil', null], ['emptyArray', []],
  ['emptyObject', {}], ['zero', 0], ['flag', false], ['text', ''], ['unknown', undefined]
]), 'flattens every leaf in document order, including empty containers and falsy values');
assert(leaves.at(-1)[1] === undefined, 'preserves undefined leaves');
assert(flattenRecord(null).length === 0 && flattenRecord(undefined).length === 0, 'absent records have no leaves');
assert(JSON.stringify(flattenRecord({})) === '[["",{}]]' && JSON.stringify(flattenRecord([])) === '[["",[]]]', 'empty root containers remain leaves');
assert(JSON.stringify(flattenRecord([[1], []])) === '[["[0][0]",1],["[1]",[]]]', 'nested arrays retain indices');

console.log('\n6. Testing comparison states:');
const stateCases = [
  [729, '729', 'format'], ['12345678905', '012345678905', 'format'],
  ['05/07/2025', '5/7/2025', 'format'], ['05/07/2025 06:04 AM', '5/7/2025 6:04 am', 'format'],
  [' Active ', 'active', 'format'], ['1.50', 1.5, 'format'], ['-2e2', -200, 'format'],
  ['000', 0, 'format'], ['09007199254740993', '9007199254740993', 'format'],
  ['9007199254740992', '9007199254740993', 'different'], ['1e400', '2e400', 'different'],
  [null, 'null', 'different'], [null, 0, 'different'], ['', 0, 'different'],
  [false, 'false', 'different'], [[], {}, 'different'], ['A', 'B', 'different'],
  ['5/7/2025 6:04 AM', '5/7/2025 6:04 PM', 'different'],
  ['5/7/2025', '5/7/2025 12:00 AM', 'different'],
  [null, null, 'same'], [[], [], 'same'], [{}, {}, 'same'], ['012345678905', '012345678905', 'same']
];
for (const [left, right, expected] of stateCases) {
  const result = compareVersions({ v1: { value: left }, v2: { value: right }, v3: null });
  assert(result.rows[0].state === expected && result.summary[expected] === 1,
    `${JSON.stringify(left)} versus ${JSON.stringify(right)} => ${expected}`);
}
const absent = compareVersions({ v1: null, v2: undefined, v3: null });
assert(JSON.stringify(absent) === JSON.stringify({ rows: [], available: { v1: false, v2: false, v3: false },
  summary: { same: 0, format: 0, different: 0, missing: 0 } }), 'all absent records produce an empty comparison');
const states = compareVersions({ v1: { a: 1, b: ' X ', c: null, d: false },
  v2: { a: 1, b: 'x', c: 'known' }, v3: { a: 1, b: 'x', c: 'known', d: false } });
assert(JSON.stringify(states.summary) === '{"same":1,"format":1,"different":1,"missing":1}', 'summary counts all four states across three versions');
assert(JSON.stringify(states.rows[3].v2) === '{"present":false,"path":null,"value":null}', 'missing cell is distinct from a present null');
assert(compareVersions({ v3: { a: 1 } }).rows[0].state === 'same', 'unavailable versions do not create missing rows');
assert(compareVersions({ v1: {}, v2: { a: 1 } }).rows.every(row => row.state === 'missing'), 'an empty record is available');

console.log('\n7. Testing aliases and filtering:');
const legacy = { original_sku: 'A', color: 'Brand blue', built_in: true, long_description: 'Long',
  image: 'image.png', itemSellingCountries: ['US'], color_relation: [{ sku: 'B' }], related_items: [] };
const middle = { color: 'Blue', brand_color: 'Brand blue', additional_data: { built_in: true, collections: [], tags: ['Tag'] },
  short_description: 'Short', long_description: 'Long', image: 'image.png', itemSellingCountries: ['US'],
  color_relation: [{ sku: 'B' }], related_items: [], type_relation: [{ sku: 'C' }] };
const modern = { brand_sku: 'A', color: { brand_color: 'Brand blue', standardized_color: 'Blue' },
  attributes: { built_in: true, collections: [], tags: ['Tag'] }, descriptions: { short_description: 'Short', long_description: 'Long' },
  primary_image: 'image.png', selling_countries: ['US'], relations: { color_relation: [{ sku: 'B' }], related_items: [], type_relation: [{ sku: 'C' }] } };
for (const [version, record] of [['v1', legacy], ['v2', middle]]) {
  const result = compareVersions({ [version]: record, v3: modern });
  assert(result.rows.filter(row => row[version].present).every(row => row.state === 'same'), `${version} aliases align with their v3 equivalents`);
  assert(result.rows.filter(row => row[version].present).length === flattenRecord(record).length, `${version} aliases preserve every source leaf`);
}
assert(ALIASES.v1.color === 'color.brand_color' && ALIASES.v2.color === 'color.standardized_color', 'exports version-specific color aliases');
const boundary = compareVersions({ v1: { color: { x: 'nested' }, color_extra: 1 },
  v3: { color: { brand_color: { x: 'nested' } }, color_extra: 1 } });
assert(boundary.rows.every(row => row.state === 'same'), 'alias matching respects dot boundaries and leaves unrelated prefixes alone');
ALIASES.v1['color.x'] = 'specific';
try {
  assert(compareVersions({ v1: { color: { x: 1 } }, v3: { specific: 1 } }).rows[0].state === 'same', 'longest matching alias wins');
} finally {
  delete ALIASES.v1['color.x'];
}
const collision = compareVersions({ v1: { image: 'first', primary_image: 'second' }, v3: { primary_image: 'first' } });
assert(collision.rows.length === 2 && collision.rows[1].v1.value === 'second', 'alias collisions retain both raw leaves');
const searchable = compareVersions({ v1: { itemSellingCountries: ['US'], image: 'a' }, v3: { selling_countries: ['US'], primary_image: 'b' } }).rows;
assert(filterRows(searchable, { query: 'ITEMSELLINGCOUNTRIES' })[0].path === 'selling_countries[0]', 'search finds a raw alias path case-insensitively');
assert(filterRows(searchable, { query: 'SELLING_COUNTRIES' }).length === 1, 'search finds canonical paths');
assert(filterRows(searchable, { onlyDifferences: true }).length === 1 && filterRows(states.rows, { onlyDifferences: true }).length === 3, 'differences filter retains format, different and missing rows');
assert(filterRows(searchable, { onlyDifferences: true, query: 'countries' }).length === 0 && filterRows(searchable).length === 2, 'filters combine and defaults retain all rows');

console.log('\n8. Testing per-zipcode comparisons and input preservation:');
const records = { v1: { status: 'Active', date_discontinued: null }, v2: { status: 'Active', date_discontinued: null },
  v3: { markets: [{ country: { country_code: 'US', zipcodes: [
    { zipcode: 63011, status: 'Active', date_discontinued: null, extra: { reason: 'A' } },
    { zipcode: 63017, status: 'Inactive', date_discontinued: '5/7/2025' }
  ] } }, { country: { zipcodes: [{ zipcode: '01234', status: ' active ' }, { zipcode: 63011, status: 'Coming Soon' }] } }] } };
const before = JSON.stringify(records);
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
const zipped = compareVersions(deepFreeze(records));
const statusRows = zipped.rows.filter(row => row.path.startsWith('status@'));
assert(statusRows.length === 4 && statusRows.map(row => row.state).join(',') === 'same,different,format,different', 'every zipcode across markets keeps its own status, including repeated zipcodes');
assert(statusRows[0].v1.path === 'status' && statusRows[0].v3.path === 'markets[0].country.zipcodes[0].status', 'zipcode comparison retains raw paths');
assert(zipped.rows.find(row => row.path === 'extra.reason@63011').v3.value === 'A' &&
  zipped.rows.find(row => row.path === 'zipcode@01234').v3.value === '01234', 'every zipcode leaf is retained, including extra fields and leading zeros');
assert(zipped.rows.find(row => row.path === 'date_discontinued@01234').state === 'missing', 'global dates expose absent zipcode dates');
assert(!zipped.rows.some(row => row.path === 'status') && zipped.rows.some(row => row.path === 'markets[0].country.country_code'), 'global status expands while country metadata remains intact');
const missingZipStatus = compareVersions({ v1: { status: 'Active' }, v3: { markets: [{ country: { zipcodes: [{ zipcode: 1 }] } }] } });
assert(missingZipStatus.rows.find(row => row.path === 'status@1').state === 'missing', 'zipcode rows without status still compare against global status');
const noZip = compareVersions({ v1: { status: 'Active' }, v3: { status: 'Active', markets: [{ country: { zipcodes: [] } }] } });
assert(noZip.rows.find(row => row.path === 'status').state === 'same', 'without zipcodes status is an ordinary row');
const unknownZip = compareVersions({ v3: { markets: [{ country: { zipcodes: [{ status: 'Active' }] } }] } });
assert(unknownZip.rows[0].path === 'markets[0].country.zipcodes[0].status', 'an absent zipcode identifier keeps its raw path instead of inventing one');
assert(JSON.stringify(records) === before && records.v3.markets[1].country.zipcodes[0].zipcode === '01234', 'frozen inputs remain unchanged');

console.log(`\n=== SUMMARY: ${passedTests}/${totalTests} tests passed cleanly! ===`);
if (passedTests !== totalTests) process.exitCode = 1;
