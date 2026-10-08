export const VERSION_ENDPOINTS = Object.freeze({
  v1: '/product',
  v2: '/v2/e-commerce/product'
});

export function versionProductUrl(baseUrl, version, sku) {
  if (typeof version !== 'string' || !Object.hasOwn(VERSION_ENDPOINTS, version) ||
      typeof sku !== 'string' || sku.length === 0) {
    return null;
  }

  return `${baseUrl}${VERSION_ENDPOINTS[version]}?sku=${encodeURIComponent(sku)}`;
}

export function describeVersionResponse(version, sku, response) {
  const records = response?.data?.data;
  const recordCount = Array.isArray(records) ? records.length : 0;
  const emptyMessage = version === 'v1'
    ? `No v1 record for SKU "${sku}". v1 covers appliances only, so furniture and mattress SKUs are not in it.`
    : `No ${version} record for SKU "${sku}".`;

  if (response?.status === 200 && response.found === true && recordCount > 0) {
    return { kind: 'record', message: null, record: records[0], recordCount };
  }
  if (response?.status === 200) {
    return { kind: 'not-found', message: emptyMessage, record: null, recordCount };
  }
  if (response?.status === 401) {
    return { kind: 'unauthorized', message: null, record: null, recordCount };
  }
  if (response?.status === 429) {
    const message = typeof response.message === 'string' && response.message.trim()
      ? response.message : 'Rate limited. Try again shortly.';
    return { kind: 'rate-limited', message, record: null, recordCount };
  }
  const detail = typeof response?.message === 'string' && response.message.trim()
    ? response.message : `HTTP ${response?.status}`;
  const message = response
    ? `Could not load ${version}: ${detail}`
    : `Could not load ${version}: no response from the service worker.`;
  return { kind: 'error', message, record: null, recordCount };
}
