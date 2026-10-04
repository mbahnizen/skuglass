/**
 * Utility helper functions for SkuGlass
 */

/**
 * Normalizes user input into array of clean SKU strings.
 * Handles comma, newline, space separated inputs, strips whitespace, converts uppercase.
 */
export function normalizeSkus(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];
  
  return rawInput
    .split(/[\s,;\n\r]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);
}

/**
 * Deduplicates filter items and groups them by filter_field name.
 * Accepts array of filter objects [{ filter_field, filter_name }].
 * Returns map: { fieldName: [filterNames] }
 */
export function dedupeAndGroupFilters(filtersArray) {
  if (!Array.isArray(filtersArray)) return {};

  const map = {};
  filtersArray.forEach(item => {
    if (!item || !item.filter_field || !item.filter_name) return;
    const field = item.filter_field.trim();
    const val = item.filter_name.trim();

    if (!map[field]) {
      map[field] = [];
    }
    if (!map[field].includes(val)) {
      map[field].push(val);
    }
  });

  return map;
}

/**
 * Safely copies text string to clipboard using Navigator Clipboard API
 * with fallback to execCommand.
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying fallback:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('Fallback clipboard copy failed:', fallbackErr);
    return false;
  }
}

/**
 * Escapes HTML characters for code node text (<, >, &).
 */
export function escapeCodeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formats JSON object into syntax-highlighted HTML string with line numbers.
 * XSS safe, with distinct token classes for keys, strings, numbers, booleans, nulls, punctuation.
 */
export function formatJsonToHtml(jsonObject) {
  if (jsonObject === undefined || jsonObject === null) {
    return `<div class="json-code-line"><span class="json-line-num">1</span><span class="json-line-content"><span class="json-null">null</span></span></div>`;
  }

  const rawStr = JSON.stringify(jsonObject, null, 2);
  const safeStr = escapeCodeHtml(rawStr);

  // Match JSON tokens: keys with colon, strings, booleans, null, numbers, punctuation
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\]:,])/g;

  const highlighted = safeStr.replace(tokenRegex, (match) => {
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        const keyName = match.slice(0, -1);
        return `<span class="json-key">${keyName}</span><span class="json-punctuation">:</span>`;
      }
      return `<span class="json-string">${match}</span>`;
    }
    if (/^(true|false)$/.test(match)) {
      return `<span class="json-boolean">${match}</span>`;
    }
    if (match === 'null') {
      return `<span class="json-null">${match}</span>`;
    }
    if (/^-?\d/.test(match)) {
      return `<span class="json-number">${match}</span>`;
    }
    if (/^[{}[\]:,]$/.test(match)) {
      return `<span class="json-punctuation">${match}</span>`;
    }
    return match;
  });

  const lines = highlighted.split('\n');
  const maxDigits = String(lines.length).length;

  return lines.map((line, idx) => {
    const num = String(idx + 1).padStart(maxDigits, ' ');
    return `<div class="json-code-line"><span class="json-line-num">${num}</span><span class="json-line-content">${line}</span></div>`;
  }).join('');
}

/**
 * Escapes unsafe HTML characters for safe use in attribute strings.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Computes overall product status across multi-market zipcode status records.
 * Returns 'Unknown', single status string (e.g. 'Active'), or 'Mixed (X/Y Active)'.
 */
export function computeOverallStatus(zipcodesList) {
  if (!Array.isArray(zipcodesList) || zipcodesList.length === 0) return 'Unknown';
  if (zipcodesList.length === 1) return zipcodesList[0].status || 'Unknown';

  const statusSet = new Set(zipcodesList.map(z => z.status));
  if (statusSet.size === 1) return zipcodesList[0].status || 'Unknown';

  const activeCount = zipcodesList.filter(z => z.status?.toLowerCase() === 'active').length;
  return `Mixed (${activeCount}/${zipcodesList.length} Active)`;
}

