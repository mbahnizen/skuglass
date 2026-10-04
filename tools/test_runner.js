import { normalizeSkus, escapeHtml, dedupeAndGroupFilters, computeOverallStatus } from '../lib/utils.js';

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
  { filter_field: 'Color', filter_name: 'Stainless Steel' },
  { filter_field: 'Color', filter_name: 'Stainless Steel' },
  { filter_field: 'Color', filter_name: 'Black' },
  { filter_field: 'Type', filter_name: 'Range Hood' }
];
const grouped = dedupeAndGroupFilters(sampleFilters);
assert(grouped['Color'].length === 2, 'deduplicates duplicate filter names');
assert(grouped['Color'].includes('Stainless Steel') && grouped['Color'].includes('Black'), 'groups filters by filter_field');

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

console.log(`\n=== SUMMARY: ${passedTests}/${totalTests} tests passed cleanly! ===`);
