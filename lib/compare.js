// Maps v1/v2 path prefixes to the v3 (canonical) path they correspond to,
// found by matching values across live SKUs. `color` is deliberately
// different per version: v1 `color` holds the brand colour, v2 `color` holds
// the standardised colour, and v2 `brand_color` holds the brand colour.
// Aliasing both to one v3 path would report a false mismatch.
export const ALIASES = {
  v1: {
    original_sku: 'brand_sku', color: 'color.brand_color', built_in: 'attributes.built_in',
    long_description: 'descriptions.long_description', image: 'primary_image',
    itemSellingCountries: 'selling_countries', color_relation: 'relations.color_relation',
    related_items: 'relations.related_items'
  },
  v2: {
    color: 'color.standardized_color', brand_color: 'color.brand_color',
    'additional_data.built_in': 'attributes.built_in',
    'additional_data.collections': 'attributes.collections',
    'additional_data.tags': 'attributes.tags', short_description: 'descriptions.short_description',
    long_description: 'descriptions.long_description', image: 'primary_image',
    itemSellingCountries: 'selling_countries', color_relation: 'relations.color_relation',
    related_items: 'relations.related_items', type_relation: 'relations.type_relation'
  }
};

export function flattenRecord(record) {
  const leaves = [];
  function visit(value, path) {
    if (value !== null && typeof value === 'object' && Object.keys(value).length) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, Array.isArray(value) ? `${path}[${key}]` : (path ? `${path}.${key}` : key));
      }
    } else {
      leaves.push([path, value]);
    }
  }
  if (record !== null && record !== undefined) visit(record, '');
  return leaves;
}

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

function canonicalPath(path, version) {
  const aliases = ALIASES[version] || {};
  const prefix = Object.keys(aliases).filter(key => matchesPrefix(path, key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix === undefined ? path : aliases[prefix] + path.slice(prefix.length);
}

// Compare decimal text without rounding long identifiers or changing raw values.
function numericKey(text) {
  const match = /^([+-]?)(\d*\.?\d+|\d+\.)(?:e([+-]?\d+))?$/i.exec(text);
  if (!match) return null;
  const [whole, fraction = ''] = match[2].split('.');
  let digits = (whole + fraction).replace(/^0+/, '');
  if (!digits) return 'number:0';
  const trailing = digits.match(/0*$/)[0].length;
  digits = digits.slice(0, digits.length - trailing);
  const exponent = BigInt(match[3] || '0') - BigInt(fraction.length) + BigInt(trailing);
  return `number:${match[1] === '-' ? '-' : ''}${digits}e${exponent}`;
}

function normalizedKey(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return `${typeof value}:${JSON.stringify(value)}`;
  }
  const text = String(value).trim().toLowerCase();
  const number = numericKey(text);
  if (number !== null) return number;
  if (typeof value === 'string') {
    const date = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}) (am|pm))?$/.exec(text);
    if (date) {
      const time = date[4] === undefined ? '' : ` ${Number(date[4])}:${Number(date[5])} ${date[6]}`;
      return `date:${Number(date[1])}/${Number(date[2])}/${date[3]}${time}`;
    }
  }
  return `${typeof value}:${text}`;
}

function zipcodeRows(record) {
  const rows = [];
  if (!Array.isArray(record?.markets)) return rows;
  record.markets.forEach((market, i) => {
    const zipcodes = market?.country?.zipcodes;
    if (!Array.isArray(zipcodes)) return;
    zipcodes.forEach((row, j) => {
      if (row?.zipcode === null || row?.zipcode === undefined) return;
      rows.push({ prefix: `markets[${i}].country.zipcodes[${j}]`, zipcode: row.zipcode });
    });
  });
  return rows;
}

export function compareVersions(records) {
  const versions = ['v1', 'v2', 'v3'];
  const available = Object.fromEntries(versions.map(version => [version, records[version] != null]));
  const zipcodes = zipcodeRows(records.v3);
  const rows = [];
  const buckets = new Map();
  function add(version, path, value, canonical, zipcodePrefix = null) {
    // Keep repeated zipcodes separate, even when their displayed paths coincide.
    const key = JSON.stringify([canonical, zipcodePrefix]);
    if (!buckets.has(key)) buckets.set(key, []);
    const bucket = buckets.get(key);
    let row = bucket.find(candidate => !candidate[version].present);
    if (!row) {
      row = { path: canonical };
      for (const name of versions) row[name] = { present: false, path: null, value: null };
      bucket.push(row);
      rows.push(row);
    }
    row[version] = { present: true, path, value };
  }
  for (const version of versions) {
    for (const [path, value] of flattenRecord(records[version])) {
      if (version !== 'v3' && zipcodes.length && (path === 'status' || path === 'date_discontinued')) {
        for (const zip of zipcodes) add(version, path, value, `${path}@${zip.zipcode}`, zip.prefix);
      } else {
        const zip = version === 'v3' && zipcodes.find(item => matchesPrefix(path, item.prefix));
        if (zip) {
          add(version, path, value, `${path.slice(zip.prefix.length + 1)}@${zip.zipcode}`, zip.prefix);
        } else {
          add(version, path, value, canonicalPath(path, version));
        }
      }
    }
  }
  const summary = { same: 0, format: 0, different: 0, missing: 0 };
  for (const row of rows) {
    const cells = versions.filter(version => available[version]).map(version => row[version]);
    if (cells.some(cell => !cell.present)) row.state = 'missing';
    else if (cells.every(cell => JSON.stringify(cell.value) === JSON.stringify(cells[0].value))) row.state = 'same';
    else if (cells.every(cell => normalizedKey(cell.value) === normalizedKey(cells[0].value))) row.state = 'format';
    else row.state = 'different';
    summary[row.state]++;
  }
  return { rows, available, summary };
}

export function filterRows(rows, { onlyDifferences = false, query = '' } = {}) {
  const needle = query.toLowerCase();
  return rows.filter(row => (!onlyDifferences || row.state !== 'same') &&
    [row.path, row.v1.path, row.v2.path, row.v3.path]
      .some(path => path !== null && path.toLowerCase().includes(needle)));
}
