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
