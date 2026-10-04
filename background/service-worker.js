// Background Service Worker for SkuGlass
// All network requests and token custody happen strictly within this service worker.

const BASE_URL = 'https://api.skulytics.io';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute TTL for the per-SKU response cache; repeat lookups inside it cost no API quota

// Setup extension behaviors on install
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lookup-sku',
      title: 'Look up SKU in SkuGlass',
      contexts: ['selection']
    });
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'lookup-sku' && tab) {
    // CRITICAL: Call chrome.sidePanel.open IMMEDIATELY before any async await calls
    // to preserve Chrome's user gesture activation token!
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        if (tab.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        } else if (tab.id) {
          await chrome.sidePanel.open({ tabId: tab.id });
        }
      } catch (e) {
        console.warn('Could not open side panel:', e);
      }
    }

    let rawText = '';

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
      if (response && response.selectionText) {
        rawText = response.selectionText;
      }
    } catch (err) {
      rawText = info.selectionText || '';
    }

    if (!rawText && info.selectionText) {
      rawText = info.selectionText;
    }

    await chrome.storage.session.set({ PENDING_LOOKUP_SELECTION: rawText });

    chrome.runtime.sendMessage({
      type: 'EXECUTE_SELECTION_LOOKUP',
      text: rawText
    }).catch(() => {});
  }
});

// Service Worker Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_DEFAULT_LOOKUP') {
    handleDefaultLookup(request.sku, request.matchingRule || 'exact', request.testToken, request.bypassCache || false)
      .then(sendResponse)
      .catch(err => sendResponse({ status: 500, error: 'NETWORK_ERROR', message: err.message }));
    return true; // Async response
  }

  if (request.type === 'FETCH_LAZY_TAB') {
    handleLazyTabFetch(request.sku, request.tabKey, request.bypassCache || false)
      .then(sendResponse)
      .catch(err => sendResponse({ status: 500, error: 'NETWORK_ERROR', message: err.message }));
    return true; // Async response
  }
});

/**
 * Handles default SKU lookup (Product + Status) with token custody, 401 handling, and chrome.storage.session cache.
 * Accepts optional testToken for inline token validation during Save Token action.
 * Accepts optional bypassCache boolean to force refetching fresh data while updating cache.
 */
async function handleDefaultLookup(sku, matchingRule = 'exact', testToken = null, bypassCache = false) {
  const cacheKey = `CACHE_DEFAULT_${sku}_${matchingRule}`;
  
  // Skip session cache if testToken or bypassCache is provided
  if (!testToken && !bypassCache) {
    const sessionData = await chrome.storage.session.get([cacheKey]);
    if (sessionData[cacheKey]) {
      const entry = sessionData[cacheKey];
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return { status: 200, productData: entry.productData, statusData: entry.statusData, cached: true };
      }
    }
  }

  // Determine token: testToken if validating, otherwise read strictly inside service worker from chrome.storage.local
  let token = testToken;
  if (!token) {
    const storage = await chrome.storage.local.get(['SKULYTICS_TOKEN']);
    token = storage.SKULYTICS_TOKEN;
  }

  if (!token) {
    return { status: 401, error: 'NO_TOKEN', message: 'Token rejected — enter it again' };
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  const productUrl = `${BASE_URL}/v3/e-commerce/product?sku=${encodeURIComponent(sku)}&matching_rule=${matchingRule}`;
  const statusUrl = `${BASE_URL}/v3/e-commerce/product/status?sku=${encodeURIComponent(sku)}`;

  try {
    const [prodRes, statRes] = await Promise.all([
      fetch(productUrl, { headers }),
      fetch(statusUrl, { headers })
    ]);

    if (prodRes.status === 401 || statRes.status === 401) {
      return { status: 401, error: 'TOKEN_REJECTED', message: 'Token rejected — check the value and try again' };
    }

    if (!prodRes.ok) {
      return { status: prodRes.status, error: 'API_ERROR', message: `Product API returned status ${prodRes.status}` };
    }

    if (!statRes.ok) {
      return { status: statRes.status, error: 'API_ERROR', message: `Status API returned status ${statRes.status}` };
    }

    const productData = await prodRes.json();
    const statusData = await statRes.json();

    // Cache in session storage if not a validation test
    if (!testToken) {
      await chrome.storage.session.set({
        [cacheKey]: {
          timestamp: Date.now(),
          productData,
          statusData
        }
      });
    }

    return { status: 200, productData, statusData, cached: false };

  } catch (err) {
    return { status: 500, error: 'NETWORK_ERROR', message: err.message };
  }
}

/**
 * Handles Lazy Tab Endpoint Fetching with verbatim endpoint paths from fixture curl preambles.
 * Accepts optional bypassCache boolean to force refetching fresh data while updating cache.
 */
async function handleLazyTabFetch(sku, tabKey, bypassCache = false) {
  // VERBATIM endpoint paths matching fixture curl preambles
  const endpointMap = {
    pricing: '/v3/e-commerce/product/price',
    specifications: '/v3/e-commerce/product/specs',
    assets: '/v3/e-commerce/product/assets',
    documents: '/v3/e-commerce/product/documents',
    features: '/v3/e-commerce/product/features',
    certifications: '/v3/e-commerce/product/certifications',
    rebates: '/v3/e-commerce/product/rebates'
    // No reviews entry: /product/reviews, /product/review and /product/ratings
    // all returned 404 against the live API on 2026-09-09, so the endpoint is
    // not reachable on this account's plan (like /product/inventory and
    // /inventory/pricing). The tab button was removed from the markup to match.
  };

  const path = endpointMap[tabKey];
  if (!path) {
    return { status: 400, error: 'UNVERIFIED_TAB', message: `Tab endpoint key "${tabKey}" is unverified or unavailable` };
  }

  const cacheKey = `CACHE_TAB_${sku}_${tabKey}`;

  if (!bypassCache) {
    const sessionData = await chrome.storage.session.get([cacheKey]);
    if (sessionData[cacheKey]) {
      const entry = sessionData[cacheKey];
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return { status: 200, data: entry.data, cached: true, endpoint: path };
      }
    }
  }

  const storage = await chrome.storage.local.get(['SKULYTICS_TOKEN']);
  const token = storage.SKULYTICS_TOKEN;

  if (!token) {
    return { status: 401, error: 'NO_TOKEN', message: 'Token rejected — enter it again' };
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  const url = `${BASE_URL}${path}?sku=${encodeURIComponent(sku)}`;

  try {
    const res = await fetch(url, { headers });
    if (res.status === 401) {
      return { status: 401, error: 'TOKEN_REJECTED', message: 'Token rejected — check the value and try again' };
    }

    if (!res.ok) {
      return { status: res.status, error: 'API_ERROR', message: `Tab API returned status ${res.status}` };
    }

    const data = await res.json();

    await chrome.storage.session.set({
      [cacheKey]: {
        timestamp: Date.now(),
        data
      }
    });

    return { status: 200, data, cached: false, endpoint: path };

  } catch (err) {
    return { status: 500, error: 'NETWORK_ERROR', message: err.message };
  }
}
