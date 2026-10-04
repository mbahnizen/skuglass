import { parseSkulyticsDate } from '../lib/date-parser.js';
import { normalizeSkus, dedupeAndGroupFilters, copyToClipboard, escapeHtml, formatJsonToHtml, computeOverallStatus } from '../lib/utils.js';

// Application State (Pure Live Mode)
const appMode = 'live'; 
let currentTheme = 'dark';
let currentSku = '';
let activeProductData = null;
let activeStatusData = null;
let activeTab = 'pricing';
let historyItems = [];
let pinnedOnlyFilter = false;

// Selected History SKUs for Bulk Operations
const selectedHistorySkus = new Set();

// Raw API JSON State for 1-Click Copy & Viewer Modal (Default Status Data First)
let activeJsonPayload = {
  combined: null,
  product: null,
  status: null,
  tab: null
};
let activeJsonTab = 'status';

// Race-Condition Prevention State for Lazy Tab In-Flight Fetches
let currentTabFetchId = 0;

// Lightbox Module State
let lightboxImages = [];
let lightboxIndex = 0;

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');

const historyNavBtn = document.getElementById('history-nav-btn');
const tokenNavBtn = document.getElementById('token-nav-btn');

const skuSearchForm = document.getElementById('sku-search-form');
const skuInput = document.getElementById('sku-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchSubmitBtn = document.getElementById('search-submit-btn');
const searchBtnLabel = document.getElementById('search-btn-label');
const searchBtnSpinner = document.getElementById('search-btn-spinner');
const skuAutocompleteList = document.getElementById('sku-autocomplete-list');
const multiSkuNotice = document.getElementById('multi-sku-notice');
const ariaAnnounceRegion = document.getElementById('aria-announce-region');

const resultsView = document.getElementById('results-view');
const tokenView = document.getElementById('token-view');

const initialState = document.getElementById('initial-state');
const initialIconLock = document.getElementById('initial-icon-lock');
const initialIconCheck = document.getElementById('initial-icon-check');
const initialTitle = document.getElementById('initial-title');
const initialStateText = document.getElementById('initial-state-text');
const setupTokenHeroBtn = document.getElementById('setup-token-hero-btn');
const changeTokenLinkBtn = document.getElementById('change-token-link-btn');

const loadingState = document.getElementById('loading-state');
const unauthorizedState = document.getElementById('unauthorized-state');
const networkErrorState = document.getElementById('network-error-state');
const networkErrorMsgText = document.getElementById('network-error-msg-text');
const retryLookupBtn = document.getElementById('retry-lookup-btn');
const notFoundState = document.getElementById('not-found-state');
const notFoundSkuText = document.getElementById('not-found-sku-text');
const tryFuzzyBtn = document.getElementById('try-fuzzy-btn');
const fuzzyPickerState = document.getElementById('fuzzy-picker-state');
const fuzzyPickerList = document.getElementById('fuzzy-picker-list');
const primaryCard = document.getElementById('primary-card');

// Card Elements (Mockup Visual Language + Interactive Hero Image + JSON Actions)
const cardBrandAvatar = document.getElementById('card-brand-avatar');
const cardSkuPill = document.getElementById('card-sku-pill');
const cacheBadge = document.getElementById('cache-badge');
const refreshLookupBtn = document.getElementById('refresh-lookup-btn');
const cardName = document.getElementById('card-name');
const cardHeroImageWrapper = document.getElementById('card-hero-image-wrapper');
const cardHeroImg = document.getElementById('card-hero-img');
const mainStatusPill = document.getElementById('main-status-pill');
const mainStatusText = document.getElementById('main-status-text');
const discontinuedNotice = document.getElementById('discontinued-date-notice');
const zipcodeStatusTbody = document.getElementById('zipcode-status-tbody');
const cardTaxonomy = document.getElementById('card-taxonomy');
const cardUpc = document.getElementById('card-upc');
const copyUpcBtn = document.getElementById('copy-upc-btn');
const cardDateModified = document.getElementById('card-date-modified');

// 1-Click Copy & View JSON Buttons
const copyJsonBtn = document.getElementById('copy-json-btn');
const viewJsonBtn = document.getElementById('view-json-btn');

// JSON Viewer Modal Elements
const jsonViewerModal = document.getElementById('json-viewer-modal');
const closeJsonModalBtn = document.getElementById('close-json-modal-btn');
const modalCopyJsonBtn = document.getElementById('modal-copy-json-btn');
const modalPayloadBadge = document.getElementById('modal-payload-badge');
const jsonSelectTabs = document.querySelectorAll('.json-select-tab');
const jsonViewerCode = document.getElementById('json-viewer-code');

const colorwaysSection = document.getElementById('colorways-section');
const colorwaySwatches = document.getElementById('colorway-swatches');
const colorwayNamesCaption = document.getElementById('colorway-names-caption');
const relatedSection = document.getElementById('related-section');
const accessoryInlineLinks = document.getElementById('accessory-inline-links');
const replacementSection = document.getElementById('replacement-section');
const replacementChips = document.getElementById('replacement-chips');
const filtersSection = document.getElementById('filters-section');
const filterGroupsContainer = document.getElementById('filter-groups-container');

// Lazy Segmented Tab Elements & Scroll Nav Controls
const tabBtns = document.querySelectorAll('.segment-tab-pill');
const tabLoading = document.getElementById('tab-loading');
const tabContentDisplay = document.getElementById('tab-content-display');
const segmentedTrack = document.querySelector('.segmented-pill-track');
const tabScrollLeftBtn = document.getElementById('tab-scroll-left-btn');
const tabScrollRightBtn = document.getElementById('tab-scroll-right-btn');

// Lightbox Modal Elements
const imageLightboxModal = document.getElementById('image-lightbox-modal');
const closeLightboxBtn = document.getElementById('close-lightbox-btn');
const lightboxPrevBtn = document.getElementById('lightbox-prev-btn');
const lightboxNextBtn = document.getElementById('lightbox-next-btn');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');

// Front Page History Elements
const frontHistorySection = document.getElementById('front-history-section');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');
const historySearchInput = document.getElementById('history-search-input');
const togglePinnedOnlyBtn = document.getElementById('toggle-pinned-only-btn');
const pinnedCountBadge = document.getElementById('pinned-count-badge');
const historyListContainer = document.getElementById('history-list-container');

// Token / Settings Elements
const closeTokenBtn = document.getElementById('close-token-btn');
const tokenInput = document.getElementById('token-input');
const toggleTokenVisBtn = document.getElementById('toggle-token-vis-btn');
const saveTokenBtn = document.getElementById('save-token-btn');
const saveTokenLabel = document.getElementById('save-token-label');
const saveTokenSpinner = document.getElementById('save-token-spinner');
const clearTokenBtn = document.getElementById('clear-token-btn');
const tokenStatusMsg = document.getElementById('token-status-msg');
const openTokenEntryBtn = document.getElementById('open-token-entry-btn');

// Initialize Extension Sidepanel
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initTheme();
  await loadStoredSettings();
  await renderHistoryList();
  await checkPendingSelectionOrOnboarding();
});

// Reduced Motion Helper - Gates JS scrollIntoView & scrollBy dynamically
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getScrollBehavior() {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

function setupEventListeners() {
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Quick Scroll to History Section on Front Page
  historyNavBtn.addEventListener('click', () => {
    switchView('results');
    if (frontHistorySection) {
      frontHistorySection.scrollIntoView({ behavior: getScrollBehavior() });
      if (historySearchInput) historySearchInput.focus();
    }
  });

  tokenNavBtn.addEventListener('click', () => switchView('token'));
  closeTokenBtn.addEventListener('click', () => switchView('results'));
  openTokenEntryBtn.addEventListener('click', () => switchView('token'));
  setupTokenHeroBtn.addEventListener('click', () => switchView('token'));
  changeTokenLinkBtn.addEventListener('click', () => switchView('token'));

  skuSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (skuAutocompleteList) skuAutocompleteList.classList.add('hidden');
    const normalized = normalizeSkus(skuInput.value);
    
    if (normalized.length > 1 && multiSkuNotice) {
      multiSkuNotice.textContent = `Pasted text contains ${normalized.length} SKUs. Showing first: ${normalized[0]}`;
      multiSkuNotice.classList.remove('hidden');
      setTimeout(() => multiSkuNotice.classList.add('hidden'), 4000);
    } else if (multiSkuNotice) {
      multiSkuNotice.classList.add('hidden');
    }

    if (normalized.length > 0) {
      executeLookup(normalized[0]);
    }
  });

  skuInput.addEventListener('input', () => {
    clearSearchBtn.hidden = !skuInput.value;
    renderAutocompleteList(skuInput.value.trim());
  });

  clearSearchBtn.addEventListener('click', () => {
    skuInput.value = '';
    clearSearchBtn.hidden = true;
    skuInput.focus();
  });

  // Autocomplete Keyboard Navigation
  skuInput.addEventListener('keydown', (e) => {
    if (skuAutocompleteList && !skuAutocompleteList.classList.contains('hidden') && currentAutocompleteMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (autocompleteSelectedIndex + 1) % currentAutocompleteMatches.length;
        setAutocompleteHighlight(nextIndex);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (autocompleteSelectedIndex - 1 + currentAutocompleteMatches.length) % currentAutocompleteMatches.length;
        setAutocompleteHighlight(prevIndex);
        return;
      }
      if (e.key === 'Enter' && autocompleteSelectedIndex >= 0) {
        e.preventDefault();
        const selected = currentAutocompleteMatches[autocompleteSelectedIndex];
        if (selected) {
          skuInput.value = selected.sku;
          hideAutocomplete();
          executeLookup(selected.sku);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }
  });

  // Global Keyboard Shortcut: '/' (when outside input) or 'Ctrl+K' / 'Cmd+K' (anywhere)
  window.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }
      e.preventDefault();
      skuInput.focus();
      skuInput.select();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      skuInput.focus();
      skuInput.select();
    }
  });

  document.addEventListener('click', (e) => {
    if (skuAutocompleteList && !skuAutocompleteList.contains(e.target) && e.target !== skuInput) {
      skuAutocompleteList.classList.add('hidden');
    }
  });

  retryLookupBtn?.addEventListener('click', () => {
    if (currentSku) executeLookup(currentSku);
  });

  refreshLookupBtn?.addEventListener('click', () => {
    if (currentSku) executeLookup(currentSku, 'exact', true);
  });

  copyUpcBtn.addEventListener('click', async () => {
    const upcVal = cardUpc.textContent.trim();
    if (upcVal && upcVal !== 'N/A') {
      const success = await copyToClipboard(upcVal);
      if (success) {
        showCopyToast(copyUpcBtn, `UPC ${upcVal} copied to clipboard.`);
      }
    }
  });

  // 1-Click Copy Raw JSON Action
  copyJsonBtn.addEventListener('click', async () => {
    if (!activeJsonPayload.combined) return;
    const jsonStr = JSON.stringify(activeJsonPayload.combined, null, 2);
    const success = await copyToClipboard(jsonStr);
    if (success) {
      showCopyToast(copyJsonBtn, 'Combined JSON payload copied to clipboard.');
    }
  });

  // View Raw JSON Viewer Modal (Defaults to active tab payload if present, otherwise Status API Data)
  viewJsonBtn.addEventListener('click', () => {
    const defaultTab = activeJsonPayload.tab ? 'tab' : 'status';
    openJsonModal(defaultTab);
  });

  closeJsonModalBtn.addEventListener('click', closeJsonModal);
  jsonViewerModal.addEventListener('click', (e) => {
    if (e.target === jsonViewerModal) closeJsonModal();
  });

  modalCopyJsonBtn.addEventListener('click', async () => {
    const targetPayload = activeJsonTab === 'tab'
      ? activeJsonPayload.tab?.data
      : (activeJsonPayload[activeJsonTab] || activeJsonPayload.status || activeJsonPayload.combined);
    if (!targetPayload) return;
    const jsonStr = JSON.stringify(targetPayload, null, 2);
    const success = await copyToClipboard(jsonStr);
    if (success) {
      showCopyToast(modalCopyJsonBtn, `${activeJsonTab.toUpperCase()} JSON payload copied to clipboard.`);
    }
  });

  jsonSelectTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      jsonSelectTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeJsonTab = tab.getAttribute('data-target');
      updateJsonModalContent();
    });
  });

  tryFuzzyBtn?.addEventListener('click', () => {
    executeLookup(currentSku, 'fuzzy');
  });

  // Hero Image Click Action: Jumps to Assets Tab & loads it
  cardHeroImageWrapper?.addEventListener('click', () => {
    activateTab('assets', true);

    const tabsContainer = document.getElementById('lazy-tabs-container');
    if (tabsContainer) {
      tabsContainer.scrollIntoView({ behavior: getScrollBehavior() });
    }
  });

  // Segmented Pill Tab Bar Handlers & Arrow Keyboard Navigation
  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      activateTab(btn.getAttribute('data-tab'));
    });

    btn.addEventListener('keydown', (e) => {
      const btns = Array.from(tabBtns);
      let targetIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (index + 1) % btns.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (index - 1 + btns.length) % btns.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = btns.length - 1;
      }

      if (targetIndex >= 0) {
        const targetTabKey = btns[targetIndex].getAttribute('data-tab');
        activateTab(targetTabKey, true);
      }
    });
  });

  // Tab Track Scroll Arrow Controls & Disabled State
  if (segmentedTrack) {
    segmentedTrack.addEventListener('scroll', updateTabScrollButtonsState);
    window.addEventListener('resize', updateTabScrollButtonsState);
  }

  if (tabScrollLeftBtn && segmentedTrack) {
    tabScrollLeftBtn.addEventListener('click', () => {
      segmentedTrack.scrollBy({ left: -110, behavior: getScrollBehavior() });
      setTimeout(updateTabScrollButtonsState, 150);
    });
  }

  if (tabScrollRightBtn && segmentedTrack) {
    tabScrollRightBtn.addEventListener('click', () => {
      segmentedTrack.scrollBy({ left: 110, behavior: getScrollBehavior() });
      setTimeout(updateTabScrollButtonsState, 150);
    });
  }

  // Mouse Wheel Horizontal Scroll Support on Tab Track
  if (segmentedTrack) {
    segmentedTrack.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        segmentedTrack.scrollLeft += e.deltaY;
        updateTabScrollButtonsState();
        e.preventDefault();
      }
    }, { passive: false });
  }

  // Lightbox Modal Controls & Backdrop Click Listener
  closeLightboxBtn.addEventListener('click', closeLightbox);
  lightboxPrevBtn.addEventListener('click', () => navigateLightbox('prev'));
  lightboxNextBtn.addEventListener('click', () => navigateLightbox('next'));
  imageLightboxModal.addEventListener('click', (e) => {
    if (e.target === imageLightboxModal) closeLightbox();
  });

  toggleTokenVisBtn.addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  saveTokenBtn.addEventListener('click', saveToken);
  clearTokenBtn.addEventListener('click', clearToken);

  // History Event Listeners
  historySearchInput.addEventListener('input', renderHistoryList);
  
  togglePinnedOnlyBtn.addEventListener('click', () => {
    pinnedOnlyFilter = !pinnedOnlyFilter;
    togglePinnedOnlyBtn.classList.toggle('active', pinnedOnlyFilter);
    renderHistoryList();
  });

  clearAllHistoryBtn.addEventListener('click', clearAllHistory);
  deleteSelectedBtn.addEventListener('click', deleteSelectedHistory);

  // Delegated Copy Evidence Button Handler on Assets Tab
  if (tabContentDisplay) {
    tabContentDisplay.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('#copy-evidence-btn');
      if (copyBtn) {
        const evidenceText = generateEvidenceText();
        if (evidenceText) {
          const success = await copyToClipboard(evidenceText);
          if (success) {
            showCopyToast(copyBtn, 'Assets evidence copied to clipboard.');
          }
        }
      }
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'EXECUTE_SELECTION_LOOKUP' && message.text) {
      const normalized = normalizeSkus(message.text);
      if (normalized.length > 0) {
        skuInput.value = normalized[0];
        switchView('results');
        executeLookup(normalized[0]);
      }
    }
  });
}

// Screen Reader Live Region Announcement Helper
function announceLiveRegion(msg) {
  if (ariaAnnounceRegion && msg) {
    ariaAnnounceRegion.textContent = '';
    setTimeout(() => {
      ariaAnnounceRegion.textContent = msg;
    }, 50);
  }
}

// Unified Copy Feedback Utility - Preserves SVG child nodes
async function showCopyToast(buttonEl, message) {
  if (!buttonEl) return;
  
  const badgeEl = buttonEl.querySelector('.copy-feedback-badge') || buttonEl.querySelector('.copy-json-badge');
  const iconSvg = buttonEl.querySelector('svg:not(.copy-feedback-badge svg)');
  const labelSpan = buttonEl.querySelector('span:not(.copy-feedback-badge)');

  if (badgeEl) {
    if (iconSvg) iconSvg.classList.add('hidden');
    badgeEl.classList.remove('hidden');
    setTimeout(() => {
      badgeEl.classList.add('hidden');
      if (iconSvg) iconSvg.classList.remove('hidden');
    }, 1800);
  } else if (labelSpan) {
    const origText = labelSpan.textContent;
    labelSpan.textContent = 'Copied!';
    setTimeout(() => {
      labelSpan.textContent = origText;
    }, 1800);
  }

  announceLiveRegion(message);
}

// Tab Track Scroll Arrow Controls & Disabled State
function updateTabScrollButtonsState() {
  if (!segmentedTrack || !tabScrollLeftBtn || !tabScrollRightBtn) return;
  const maxScroll = segmentedTrack.scrollWidth - segmentedTrack.clientWidth;
  if (maxScroll <= 2) {
    tabScrollLeftBtn.disabled = true;
    tabScrollRightBtn.disabled = true;
    return;
  }
  tabScrollLeftBtn.disabled = segmentedTrack.scrollLeft <= 1;
  tabScrollRightBtn.disabled = segmentedTrack.scrollLeft >= maxScroll - 2;
}

// Modal Focus Trap & Restoration Helpers
let activeModalLastFocus = null;

function setupModalFocusTrap(modalEl, defaultFocusEl) {
  activeModalLastFocus = document.activeElement;
  modalEl.classList.remove('hidden');
  if (defaultFocusEl) defaultFocusEl.focus();

  const handleModalKeyDown = (e) => {
    if (e.key === 'Tab') {
      const focusables = Array.from(modalEl.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  modalEl._focusTrapHandler = handleModalKeyDown;
  modalEl.addEventListener('keydown', handleModalKeyDown);
}

function closeModalHelper(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  if (modalEl._focusTrapHandler) {
    modalEl.removeEventListener('keydown', modalEl._focusTrapHandler);
    delete modalEl._focusTrapHandler;
  }
  if (activeModalLastFocus) {
    activeModalLastFocus.focus();
    activeModalLastFocus = null;
  }
}

const tabNameMap = {
  pricing: 'Pricing API',
  specifications: 'Specifications API',
  assets: 'Assets API',
  documents: 'Documents API',
  features: 'Features API',
  certifications: 'Certifications API',
  rebates: 'Rebates API'
};

// JSON Viewer Modal Functions (Supports Active Tab Payload & Dynamic 4th Selector)
function openJsonModal(initialTab = null) {
  const targetTab = initialTab || (activeJsonPayload.tab ? 'tab' : 'status');
  activeJsonTab = targetTab;
  jsonSelectTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-target') === targetTab));
  updateJsonModalContent();
  setupModalFocusTrap(jsonViewerModal, closeJsonModalBtn);
  announceLiveRegion(`JSON payload viewer opened on ${targetTab} tab.`);
}

function closeJsonModal() {
  closeModalHelper(jsonViewerModal);
}

function updateJsonModalContent() {
  const tabSelectorBtn = document.querySelector('.json-select-tab[data-target="tab"]');
  if (tabSelectorBtn) {
    if (activeJsonPayload.tab) {
      tabSelectorBtn.disabled = false;
      tabSelectorBtn.textContent = tabNameMap[activeJsonPayload.tab.tabKey] || 'Active Tab';
    } else {
      tabSelectorBtn.disabled = true;
      tabSelectorBtn.textContent = 'Active Tab';
      if (activeJsonTab === 'tab') {
        activeJsonTab = 'status';
        jsonSelectTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-target') === 'status'));
      }
    }
  }

  const targetPayload = activeJsonTab === 'tab'
    ? activeJsonPayload.tab?.data
    : (activeJsonPayload[activeJsonTab] || activeJsonPayload.status || activeJsonPayload.combined);
  
  if (modalPayloadBadge) {
    const labels = {
      status: 'Status API',
      product: 'Product API',
      combined: 'Combined Payload',
      tab: activeJsonPayload.tab ? (tabNameMap[activeJsonPayload.tab.tabKey] || 'Tab API') : 'Active Tab'
    };
    modalPayloadBadge.textContent = labels[activeJsonTab] || 'Payload';
  }

  if (!targetPayload) {
    jsonViewerCode.innerHTML = `<div class="json-code-line"><span class="json-line-num">1</span><span class="json-line-content"><span class="json-null">// No payload data available</span></span></div>`;
    return;
  }

  jsonViewerCode.innerHTML = formatJsonToHtml(targetPayload);
}

// Lightbox Navigation Functions
function openLightbox(imagesArray, initialIndex = 0) {
  if (!imagesArray || imagesArray.length === 0) return;
  lightboxImages = imagesArray;
  lightboxIndex = Math.max(0, Math.min(initialIndex, imagesArray.length - 1));
  updateLightboxContent();
  setupModalFocusTrap(imageLightboxModal, closeLightboxBtn);
  document.addEventListener('keydown', handleLightboxKeydown);
  announceLiveRegion(`Image preview lightbox opened. Image ${lightboxIndex + 1} of ${imagesArray.length}.`);
}

function closeLightbox() {
  closeModalHelper(imageLightboxModal);
  lightboxImg.src = '';
  lightboxImages = [];
  lightboxIndex = 0;
  document.removeEventListener('keydown', handleLightboxKeydown);
}

function updateLightboxContent() {
  if (lightboxImages.length === 0) return;
  const currentImg = lightboxImages[lightboxIndex];
  const prodName = activeProductData?.name ?? 'Product';
  lightboxImg.src = currentImg.url || '';
  lightboxImg.alt = `${prodName} - Asset ${lightboxIndex + 1} of ${lightboxImages.length}`;
  const sizeInfo = currentImg.content_length ? ` • ${currentImg.content_length}` : '';
  lightboxCaption.textContent = `${prodName} — Image ${lightboxIndex + 1} of ${lightboxImages.length}${sizeInfo}`;
}

function navigateLightbox(direction) {
  if (lightboxImages.length === 0) return;
  if (direction === 'next') {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  } else if (direction === 'prev') {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  }
  updateLightboxContent();
}

function handleLightboxKeydown(e) {
  if (imageLightboxModal.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateLightbox('next');
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateLightbox('prev');
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeLightbox();
  }
}

// Theme Logic
async function initTheme() {
  const data = await chrome.storage.local.get(['SKULYTICS_THEME']);
  if (data.SKULYTICS_THEME) {
    currentTheme = data.SKULYTICS_THEME;
  } else {
    currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIconSun.classList.remove('hidden');
    themeIconMoon.classList.add('hidden');
  } else {
    themeIconSun.classList.add('hidden');
    themeIconMoon.classList.remove('hidden');
  }
}

async function toggleTheme() {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  await chrome.storage.local.set({ SKULYTICS_THEME: newTheme });
}

// Mode & Settings (the bearer token is read only inside the service worker and never prefilled in the DOM)
async function loadStoredSettings() {
  try {
    const data = await chrome.storage.local.get(['SKULYTICS_TOKEN_SET']);
    if (data.SKULYTICS_TOKEN_SET && tokenInput) {
      tokenInput.placeholder = 'Token configured — enter value to replace';
    }
  } catch (err) {
    console.warn('Storage read error:', err);
  }
}

async function checkPendingSelectionOrOnboarding() {
  try {
    const sessionData = await chrome.storage.session.get(['PENDING_LOOKUP_SELECTION']);
    if (sessionData && sessionData.PENDING_LOOKUP_SELECTION) {
      await chrome.storage.session.remove('PENDING_LOOKUP_SELECTION');
      const normalized = normalizeSkus(sessionData.PENDING_LOOKUP_SELECTION);
      if (normalized.length > 0) {
        skuInput.value = normalized[0];
        executeLookup(normalized[0]);
        return;
      }
    }
  } catch (err) {
    console.warn('Session selection check error:', err);
  }

  const localData = await chrome.storage.local.get(['SKULYTICS_TOKEN_SET']);
  const hasToken = Boolean(localData.SKULYTICS_TOKEN_SET);
  
  if (!currentSku) {
    if (hasToken) {
      initialState.classList.add('hidden');
    } else {
      showState('initial');
      updateOnboardingState(false);
    }
  }
}

function updateOnboardingState(hasToken) {
  if (hasToken) {
    initialState.classList.add('hidden');
  } else {
    initialIconLock.classList.remove('hidden');
    initialIconCheck.classList.add('hidden');
    initialTitle.textContent = 'Welcome to SkuGlass';
    initialStateText.textContent = 'Enter your Skulytics Bearer Token to begin live SKU queries — SkuGlass pulls product data directly from the Skulytics API.';
    setupTokenHeroBtn.classList.remove('hidden');
    changeTokenLinkBtn.classList.add('hidden');
  }
}

function switchView(viewName) {
  tokenView.classList.add('hidden');

  if (viewName === 'token') {
    resultsView.classList.add('hidden');
    tokenView.classList.remove('hidden');
  } else {
    resultsView.classList.remove('hidden');
    renderHistoryList();
  }
}

// Execute Lookup Logic
async function executeLookup(sku, matchingRule = 'exact', bypassCache = false) {
  currentSku = sku;
  setSearchButtonLoading(true);
  showState('loading');
  announceLiveRegion(`Searching for SKU "${sku}"...`);

  try {
    await executeLiveLookup(sku, matchingRule, bypassCache);
  } finally {
    setSearchButtonLoading(false);
  }
}

function setSearchButtonLoading(isLoading) {
  searchSubmitBtn.disabled = isLoading;
  if (isLoading) {
    searchBtnLabel.classList.add('hidden');
    searchBtnSpinner.classList.remove('hidden');
  } else {
    searchBtnLabel.classList.remove('hidden');
    searchBtnSpinner.classList.add('hidden');
  }
}

async function executeLiveLookup(sku, matchingRule, bypassCache = false) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_DEFAULT_LOOKUP',
      sku,
      matchingRule,
      bypassCache
    });

    if (!response) {
      showState('network-error');
      if (networkErrorMsgText) networkErrorMsgText.textContent = 'No response received from background service worker.';
      announceLiveRegion('No response received from background service worker.');
      return;
    }

    if (response.status === 401) {
      showState('unauthorized');
      announceLiveRegion('Skulytics Bearer Token rejected (401 Unauthorized).');
      return;
    }

    if (response.status === 500 || response.error === 'NETWORK_ERROR') {
      showState('network-error');
      if (networkErrorMsgText) networkErrorMsgText.textContent = response.message || 'Could not connect to Skulytics API (500 Server Error).';
      announceLiveRegion('Network or server error connecting to Skulytics API.');
      return;
    }

    if (response.status !== 200) {
      notFoundSkuText.textContent = response.message || `API error (${response.status})`;
      showState('not-found');
      announceLiveRegion(response.message || `API error (${response.status})`);
      return;
    }

    const { productData, statusData } = response;
    const items = productData?.data || [];

    if (items.length === 0 || (productData?.meta && productData.meta.total === 0)) {
      notFoundSkuText.textContent = `No product found for SKU "${sku}".`;
      showState('not-found');
      announceLiveRegion(`No product found for SKU "${sku}".`);
      return;
    }

    // Reveal Cache Badge when data came from 15-min session cache
    if (cacheBadge) {
      cacheBadge.classList.toggle('hidden', !response.cached);
    }

    if (matchingRule === 'fuzzy' && items.length > 1) {
      renderFuzzyPicker(items, statusData);
      showState('fuzzy-picker');
      announceLiveRegion(`Multiple product matches found for SKU "${sku}". Please select a product.`);
      return;
    }

    activeProductData = items[0];
    activeStatusData = statusData;

    // Cache Raw JSON Payload for 1-Click Copy and Modal Viewer (Reset active tab payload on new SKU lookup)
    activeJsonPayload = {
      product: activeProductData,
      status: activeStatusData,
      combined: {
        product: activeProductData,
        status: activeStatusData
      },
      tab: null
    };

    renderPrimaryCard(activeProductData, activeStatusData);
    showState('card');
    loadLazyTabData(activeTab, bypassCache);
    saveHistoryItem(activeProductData, activeStatusData);

  } catch (err) {
    console.error('Live lookup failed:', err);
    if (networkErrorMsgText) networkErrorMsgText.textContent = `Network connection failed: ${err.message}`;
    showState('network-error');
  }
}

function renderFuzzyPicker(items, statusData) {
  if (!fuzzyPickerList) return;
  fuzzyPickerList.innerHTML = '';
  fuzzyPickerList.style.pointerEvents = 'auto';

  items.forEach(prod => {
    const prodName = prod?.name ?? 'Unnamed Product';
    const brandName = prod?.brand?.brand_name ?? (typeof prod?.brand === 'string' ? prod.brand : 'N/A');
    const prodSku = prod?.sku ?? 'N/A';

    const div = document.createElement('div');
    div.className = 'picker-item';
    div.title = `Click to select SKU: ${prodSku} (${prodName})`;
    div.innerHTML = `
      <div class="picker-item-title" title="${escapeHtml(prodName)}">${escapeHtml(prodName)}</div>
      <div class="picker-item-sub">Brand: ${escapeHtml(brandName)} | SKU: ${escapeHtml(prodSku)}</div>
    `;
    div.addEventListener('click', () => {
      // Prevent double trigger during rapid clicks
      fuzzyPickerList.style.pointerEvents = 'none';

      // Reset cache badge on picker choice
      if (cacheBadge) cacheBadge.classList.add('hidden');

      activeProductData = prod;
      activeStatusData = statusData;

      activeJsonPayload = {
        product: activeProductData,
        status: activeStatusData,
        combined: {
          product: activeProductData,
          status: activeStatusData
        },
        tab: null
      };

      renderPrimaryCard(activeProductData, activeStatusData);
      showState('card');
      loadLazyTabData(activeTab);
      saveHistoryItem(activeProductData, activeStatusData);
    });
    fuzzyPickerList.appendChild(div);
  });
}

function showState(stateName) {
  initialState.classList.add('hidden');
  loadingState.classList.add('hidden');
  unauthorizedState.classList.add('hidden');
  if (networkErrorState) networkErrorState.classList.add('hidden');
  notFoundState.classList.add('hidden');
  fuzzyPickerState.classList.add('hidden');
  primaryCard.classList.add('hidden');

  if (stateName === 'loading') loadingState.classList.remove('hidden');
  else if (stateName === 'unauthorized') unauthorizedState.classList.remove('hidden');
  else if (stateName === 'network-error' && networkErrorState) networkErrorState.classList.remove('hidden');
  else if (stateName === 'not-found') notFoundState.classList.remove('hidden');
  else if (stateName === 'fuzzy-picker') fuzzyPickerState.classList.remove('hidden');
  else if (stateName === 'card') {
    primaryCard.classList.remove('hidden');
    primaryCard.classList.remove('card-animate');
    void primaryCard.offsetWidth;
    primaryCard.classList.add('card-animate');
  } else {
    initialState.classList.remove('hidden');
  }
}

// RENDER PRIMARY CARD (WITH HERO IMAGE & COLORWAY INDEX PALETTE + FULL HOVER TOOLTIPS)
function renderPrimaryCard(product, statusPayload) {
  // 1. Header Row: Brand Logo or Fallback Initial Circle + SKU Pill + Status Glow Pill
  // Never invent a brand when the API omits one - an unbranded record must read
  // as unknown, not as some other manufacturer's product.
  const brandName = product.brand?.brand_name || 'Unknown brand';
  const brandInitial = product.brand?.brand_name ? brandName.charAt(0).toUpperCase() : '?';

  const brandImgUrl = product.brand?.brand_image?.url || (typeof product.brand?.brand_image === 'string' ? product.brand.brand_image : null);

  if (brandImgUrl) {
    cardBrandAvatar.innerHTML = `<img class="brand-logo-img" src="${escapeHtml(brandImgUrl)}" alt="${escapeHtml(brandName)}" title="Brand: ${escapeHtml(brandName)}" />`;
    cardBrandAvatar.className = 'brand-avatar-container';
  } else {
    cardBrandAvatar.innerHTML = `<div class="brand-avatar-fallback" title="Brand: ${escapeHtml(brandName)}">${escapeHtml(brandInitial)}</div>`;
    cardBrandAvatar.className = 'brand-avatar-container';
  }

  cardSkuPill.textContent = `SKU: ${product.sku}`;
  cardSkuPill.title = `Full SKU: ${product.sku}`;

  const productName = product.name || 'Unnamed Product';
  cardName.textContent = productName;
  cardName.title = productName;

  // Hero Product Image (primary_image)
  const heroUrl = product.primary_image?.url || (typeof product.primary_image === 'string' ? product.primary_image : null);
  if (heroUrl) {
    cardHeroImg.src = heroUrl;
    cardHeroImg.alt = `${productName} - Primary Image`;
    cardHeroImg.title = `Click to open enlarged preview for ${productName}`;
    cardHeroImageWrapper.classList.remove('hidden');
  } else {
    cardHeroImageWrapper.classList.add('hidden');
  }

  // Zipcode Status Table & Multi-Market Overall Status
  zipcodeStatusTbody.innerHTML = '';
  let dateDiscontinuedStr = null;

  const zipcodesList = [];
  if (statusPayload && statusPayload.data) {
    for (const item of statusPayload.data) {
      if (item.markets) {
        for (const market of item.markets) {
          if (market.country && market.country.zipcodes) {
            for (const z of market.country.zipcodes) {
              zipcodesList.push(z);
            }
          }
        }
      }
    }
  }

  const overallStatus = computeOverallStatus(zipcodesList);
  const singleZipcodeStrip = document.getElementById('single-zipcode-strip');
  const zipcodeTableContainer = document.getElementById('zipcode-table-container');

  if (zipcodesList.length === 1) {
    // Render single-row compact status strip OUTSIDE <table> and hide table container (saves ~37px vertical space)
    if (zipcodeTableContainer) zipcodeTableContainer.classList.add('hidden');
    if (singleZipcodeStrip) {
      const z = zipcodesList[0];

      let discStr = '—';
      if (z.date_discontinued) {
        discStr = parseSkulyticsDate(z.date_discontinued);
        dateDiscontinuedStr = discStr;
      }

      singleZipcodeStrip.innerHTML = `
        <span class="single-zipcode-item"><span class="single-zipcode-label">Zipcode:</span> <span class="single-zipcode-val">${escapeHtml(String(z.zipcode))}</span></span>
        <span class="single-zipcode-dot">&bull;</span>
        <span class="single-zipcode-item"><span class="single-zipcode-label">Status:</span> <span class="single-zipcode-val">${escapeHtml(z.status)}</span></span>
        <span class="single-zipcode-dot">&bull;</span>
        <span class="single-zipcode-item"><span class="single-zipcode-label">Discontinued:</span> <span class="single-zipcode-val">${escapeHtml(discStr)}</span></span>
      `;
      singleZipcodeStrip.classList.remove('hidden');
    }

  } else if (zipcodesList.length >= 2) {
    // Standard 3-column table for multiple market zipcodes
    if (singleZipcodeStrip) singleZipcodeStrip.classList.add('hidden');
    if (zipcodeTableContainer) zipcodeTableContainer.classList.remove('hidden');

    zipcodesList.forEach(z => {
      const tr = document.createElement('tr');
      
      const tdZip = document.createElement('td');
      tdZip.textContent = String(z.zipcode);
      tdZip.title = `Market Zipcode: ${z.zipcode}`;
      tr.appendChild(tdZip);

      const tdStatus = document.createElement('td');
      tdStatus.textContent = z.status;
      tdStatus.title = `Product Status: ${z.status}`;
      tr.appendChild(tdStatus);

      const tdDisc = document.createElement('td');
      if (z.date_discontinued) {
        const formattedDate = parseSkulyticsDate(z.date_discontinued);
        tdDisc.textContent = formattedDate;
        tdDisc.title = `Discontinued Date: ${formattedDate}`;
        dateDiscontinuedStr = formattedDate;
      } else {
        tdDisc.textContent = '—';
        tdDisc.title = 'Active (No Discontinued Date)';
      }
      tr.appendChild(tdDisc);

      zipcodeStatusTbody.appendChild(tr);
    });
  } else {
    // 0 Zipcode records: Unknown overall status
    if (zipcodeTableContainer) zipcodeTableContainer.classList.add('hidden');
    if (singleZipcodeStrip) {
      singleZipcodeStrip.innerHTML = `<span class="single-zipcode-item"><span class="single-zipcode-label">Status:</span> <span class="single-zipcode-val">No zipcode status records available</span></span>`;
      singleZipcodeStrip.classList.remove('hidden');
    }
  }

  // Header Right Soft Glow Status Pill
  mainStatusPill.className = `status-pill ${getStatusCssClass(overallStatus)}`;
  mainStatusText.textContent = overallStatus;
  mainStatusPill.title = `Overall Status: ${overallStatus}`;

  if (dateDiscontinuedStr && overallStatus.toLowerCase() === 'discontinued') {
    discontinuedNotice.textContent = `Discontinued: ${dateDiscontinuedStr}`;
    discontinuedNotice.title = `Discontinued Date: ${dateDiscontinuedStr}`;
    discontinuedNotice.classList.remove('hidden');
  } else {
    discontinuedNotice.classList.add('hidden');
  }

  // Apply tab pill empty styling if known from session storage
  updateTabPillStylesForSku(product.sku);

  // 2. 3-Column Metadata Strip (Taxonomy | UPC | Last Updated) with Full Untruncated Tooltips
  const cat = product.category?.category_name || '';
  const sub = product.subcategory?.subcategory_name || '';
  const det = product.detail_category?.detail_category_name || '';
  const taxParts = [cat, sub, det].filter(Boolean);
  const taxFullStr = taxParts.length > 0 ? taxParts.join(' > ') : 'N/A';
  cardTaxonomy.textContent = taxFullStr;
  cardTaxonomy.title = `Full Taxonomy: ${taxFullStr}`;

  const upcStr = typeof product.upc === 'string' ? product.upc : (product.upc != null ? String(product.upc) : 'N/A');
  cardUpc.textContent = upcStr;
  cardUpc.title = `UPC Code: ${upcStr}`;

  const dateModStr = parseSkulyticsDate(product.date_modified) || 'N/A';
  cardDateModified.textContent = dateModStr;
  cardDateModified.title = `Last Updated Date: ${dateModStr}`;

  // 3. Colorways as Swatches with Index-Keyed Palette + Visible Text Caption Line
  colorwaySwatches.innerHTML = '';
  colorwayNamesCaption.textContent = '';
  const colorways = product.relations?.color_relation || [];
  
  if (colorways.length > 0) {
    colorwaysSection.classList.remove('hidden');
    const colorNamesList = [];

    colorways.forEach((c, index) => {
      if (c.sku) {
        const colorName = c.brand_color || 'Standard';
        colorNamesList.push(colorName);

        const swatch = document.createElement('button');
        swatch.className = 'colorway-swatch';
        swatch.style.backgroundColor = getColorHex(c.brand_color, index);
        swatch.title = `Colorway: ${colorName} (Click to look up SKU: ${c.sku})`;
        swatch.setAttribute('aria-label', `${colorName} SKU ${c.sku}`);
        swatch.addEventListener('click', () => {
          skuInput.value = c.sku;
          executeLookup(c.sku);
        });
        colorwaySwatches.appendChild(swatch);
      }
    });

    if (colorNamesList.length > 0) {
      const fullColorwaysText = colorNamesList.join(', ');
      colorwayNamesCaption.textContent = fullColorwaysText;
      colorwayNamesCaption.title = `All Available Colorways: ${fullColorwaysText}`;
    }
  } else {
    colorwaysSection.classList.add('hidden');
  }

  // 4. Accessories grouped by item_type (avoids repeating the same type label on every link)
  accessoryInlineLinks.innerHTML = '';
  const related = product.relations?.related_items || [];
  if (related.length > 0) {
    relatedSection.classList.remove('hidden');

    const groups = {};
    related.forEach((rel) => {
      if (!rel.sku) return;
      const groupKey = rel.item_type || 'Related';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(rel.sku);
    });

    Object.keys(groups).forEach((groupKey) => {
      const groupRow = document.createElement('div');
      groupRow.className = 'accessory-group-row';

      const groupLabel = document.createElement('span');
      groupLabel.className = 'accessory-group-label';
      groupLabel.textContent = `${groupKey}:`;
      groupRow.appendChild(groupLabel);

      groups[groupKey].forEach((sku, index) => {
        const link = document.createElement('a');
        link.className = 'accessory-inline-link';
        link.textContent = sku;
        link.title = `Click to look up SKU: ${sku}`;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          skuInput.value = sku;
          executeLookup(sku);
        });
        groupRow.appendChild(link);

        if (index < groups[groupKey].length - 1) {
          groupRow.appendChild(document.createTextNode(', '));
        }
      });

      accessoryInlineLinks.appendChild(groupRow);
    });
  } else {
    relatedSection.classList.add('hidden');
  }

  // Replacement Chain Chips
  replacementChips.innerHTML = '';
  const replacements = [
    { label: 'Replaced By', sku: product.replaced_sku },
    { label: 'Alt SKU', sku: product.alternate_sku },
    { label: 'Short SKU', sku: product.short_sku }
  ].filter(r => r.sku != null);

  if (replacements.length > 0) {
    replacementSection.classList.remove('hidden');
    replacements.forEach(r => {
      const chip = document.createElement('button');
      chip.className = 'chip-item';
      chip.textContent = `${r.label}: ${r.sku}`;
      chip.title = `${r.label}: ${r.sku} (Click to look up)`;
      chip.addEventListener('click', () => {
        skuInput.value = r.sku;
        executeLookup(r.sku);
      });
      replacementChips.appendChild(chip);
    });
  } else {
    replacementSection.classList.add('hidden');
  }

  // Specification / Filter Table with Full Tooltips on Spec Names & Values
  filterGroupsContainer.innerHTML = '';
  const groupedFilters = dedupeAndGroupFilters(product.filter);
  const fields = Object.keys(groupedFilters);

  if (fields.length > 0) {
    filtersSection.classList.remove('hidden');
    fields.forEach(field => {
      const row = document.createElement('div');
      row.className = 'spec-row';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'spec-name';
      nameSpan.textContent = field;
      nameSpan.title = field;

      const valSpan = document.createElement('span');
      valSpan.className = 'spec-val';
      const valStr = groupedFilters[field].join(', ');
      valSpan.textContent = valStr;
      valSpan.title = valStr;

      row.appendChild(nameSpan);
      row.appendChild(valSpan);
      filterGroupsContainer.appendChild(row);
    });
  } else {
    filtersSection.classList.add('hidden');
  }

  announceLiveRegion(`Product ${productName} loaded. Overall status: ${overallStatus}.`);
}

function getStatusCssClass(statusStr) {
  if (!statusStr) return 'status-inactive';
  const lower = statusStr.toLowerCase();
  if (lower.startsWith('mixed')) return 'status-coming';
  if (lower === 'active') return 'status-active';
  if (lower === 'coming soon') return 'status-coming';
  if (lower === 'discontinued') return 'status-discontinued';
  return 'status-inactive';
}

/**
 * Maps brand color strings to HEX colors. Uses index-keyed neutral palette fallback
 * when keyword matching fails so swatches with identical names remain visually distinct.
 */
function getColorHex(colorName, index = 0) {
  if (!colorName) return getNeutralFallback(index);
  const lower = colorName.toLowerCase();
  if (lower.includes('stainless') || lower.includes('steel')) return '#94a3b8';
  if (lower.includes('black') && !lower.includes('slate')) return '#1e293b';
  if (lower.includes('white')) return '#f8fafc';
  if (lower.includes('slate') || lower.includes('gray') || lower.includes('grey')) return '#475569';
  if (lower.includes('bronze') || lower.includes('brown')) return '#5c4033';
  if (lower.includes('red')) return '#ef4444';
  if (lower.includes('blue')) return '#3b82f6';
  return getNeutralFallback(index);
}

function getNeutralFallback(index) {
  const neutrals = ['#64748b', '#475569', '#334155', '#94a3b8', '#cbd5e1'];
  return neutrals[index % neutrals.length];
}

// TAB ACTIVATOR & ROVING TABINDEX MANAGER
function activateTab(tabKey, focusImmediately = false) {
  activeTab = tabKey;

  tabBtns.forEach(btn => {
    const isCurrent = btn.getAttribute('data-tab') === tabKey;
    btn.classList.toggle('active', isCurrent);
    btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    btn.setAttribute('tabindex', isCurrent ? '0' : '-1');

    if (isCurrent) {
      btn.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest', inline: 'center' });
      if (focusImmediately) btn.focus();
    }
  });

  if (tabContentDisplay) {
    tabContentDisplay.setAttribute('aria-labelledby', `tab-btn-${tabKey}`);
  }

  updateTabScrollButtonsState();
  loadLazyTabData(tabKey);
}

// LAZY TAB RENDERER (WITH ASYNC RACE CONDITION DISCARD GUARD & E2 ACTIVE TAB PAYLOAD STORAGE)
async function loadLazyTabData(tabKey, bypassCache = false) {
  const fetchId = ++currentTabFetchId;

  tabLoading.classList.remove('hidden');
  tabContentDisplay.classList.remove('fade-tab-content');
  tabContentDisplay.innerHTML = '';

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'FETCH_LAZY_TAB',
      sku: currentSku,
      tabKey,
      bypassCache
    });

    // Discard stale in-flight response if user switched tabs mid-request!
    if (fetchId !== currentTabFetchId || tabKey !== activeTab) {
      return;
    }

    if (res.status === 401) {
      activeJsonPayload.tab = null;
      showState('unauthorized');
      return;
    }

    if (res.status !== 200 || !res.data) {
      activeJsonPayload.tab = null;
      renderTabContent(tabKey, res.data);
      return;
    }
    
    const tabData = res.data;

    // Discard stale in-flight response if user switched tabs mid-request!
    if (fetchId !== currentTabFetchId || tabKey !== activeTab) {
      return;
    }

    // Store active tab payload strictly when status === 200 and after race condition guards pass
    activeJsonPayload.tab = {
      tabKey,
      data: tabData,
      cached: res.cached === true,
      fetchedAt: Date.now(),
      endpoint: res.endpoint || ''
    };

    renderTabContent(tabKey, tabData);

    void tabContentDisplay.offsetWidth;
    tabContentDisplay.classList.add('fade-tab-content');

  } catch (err) {
    if (fetchId === currentTabFetchId && tabKey === activeTab) {
      activeJsonPayload.tab = null;
      tabContentDisplay.innerHTML = `<p class="error-text">Failed to load tab data: ${err.message}</p>`;
    }
  } finally {
    if (fetchId === currentTabFetchId && tabKey === activeTab) {
      tabLoading.classList.add('hidden');
    }
  }
}

function renderTabContent(tabKey, dataPayload) {
  const data = dataPayload?.data;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    tabContentDisplay.innerHTML = '<p class="tab-empty-msg">No records available for this tab.</p>';
    markTabEmptyInSession(currentSku, tabKey);
    updateTabPillStylesForSku(currentSku);
    return;
  }

  let html = '';

  if (tabKey === 'specifications') {
    const item = Array.isArray(data) ? data[0] : data;
    const specs = item?.product_specs || item?.specifications || [];

    if (specs.length === 0) {
      html = '<p class="tab-empty-msg">No specification details available.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      const sections = {};
      specs.forEach(s => {
        const sec = s.section || 'General';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(s);
      });

      html = `<div class="spec-table-container">`;
      for (const secName of Object.keys(sections)) {
        html += `<div class="spec-section-header" title="Section: ${escapeHtml(secName)}">${escapeHtml(secName)}</div>`;
        sections[secName].forEach(s => {
          const specName = s.spec || s.name || 'Spec';
          const specVal = s.value || s.specification_value || 'N/A';
          html += `
            <div class="spec-row">
              <span class="spec-name" title="${escapeHtml(specName)}">${escapeHtml(specName)}</span>
              <span class="spec-val" title="${escapeHtml(specVal)}">${escapeHtml(specVal)}</span>
            </div>
          `;
        });
      }
      html += `</div>`;
    }

  } else if (tabKey === 'pricing') {
    const item = Array.isArray(data) ? data[0] : data;
    const mfg = item?.price?.manufacturer_price;
    const zipcode = item?.market?.zipcode || '63011';

    if (mfg) {
      const mapPrice = mfg.map?.price ? `$${mfg.map.price}` : 'N/A';
      const msrpPrice = mfg.msrp?.price ? `$${mfg.msrp.price}` : 'N/A';
      const mapUpdated = mfg.map?.last_updated ? parseSkulyticsDate(mfg.map.last_updated) : '';

      html = `
        <div class="spec-table-container">
          <div class="spec-row">
            <span class="spec-name">Market Zipcode</span>
            <span class="spec-val" title="Zipcode: ${zipcode}">${zipcode}</span>
          </div>
          <div class="spec-row">
            <span class="spec-name">MAP Price</span>
            <span class="spec-val text-accent" title="MAP: ${mapPrice}">${mapPrice}</span>
          </div>
          <div class="spec-row">
            <span class="spec-name">MSRP Price</span>
            <span class="spec-val" title="MSRP: ${msrpPrice}">${msrpPrice}</span>
          </div>
          ${mapUpdated ? `
          <div class="spec-row">
            <span class="spec-name">Price Updated</span>
            <span class="spec-val" title="Updated: ${mapUpdated}">${mapUpdated}</span>
          </div>` : ''}
        </div>
      `;
    } else {
      html = '<p class="tab-empty-msg">No pricing data available.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    }

  } else if (tabKey === 'assets') {
    const item = Array.isArray(data) ? data[0] : data;
    const images = item?.product_images || [];
    const prodName = activeProductData?.name ?? 'Product';

    // Header container with Copy evidence button (Always rendered even when images.length === 0)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'copy-evidence-header';
    headerDiv.innerHTML = `
      <button id="copy-evidence-btn" class="secondary-btn copy-evidence-btn" title="Copy Skulytics API evidence block for support threads" aria-label="Copy Evidence">
        <svg class="copy-evidence-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy evidence</span>
      </button>
    `;
    tabContentDisplay.appendChild(headerDiv);

    if (images.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'tab-empty-msg';
      emptyMsg.textContent = 'No image assets available.';
      tabContentDisplay.appendChild(emptyMsg);
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      const galleryDiv = document.createElement('div');
      galleryDiv.className = 'gallery-grid';

      images.forEach((img, idx) => {
        const btn = document.createElement('button');
        btn.className = 'asset-thumb-btn';
        btn.title = `View image ${idx + 1} of ${images.length} (${img?.content_length ?? 'JPEG'})`;
        btn.innerHTML = `<img src="${escapeHtml(img?.url ?? '')}" class="asset-thumb-img" alt="${escapeHtml(prodName)} - Asset ${idx + 1} of ${images.length}" title="Asset ${idx + 1}" />`;
        btn.addEventListener('click', () => {
          openLightbox(images, idx);
        });
        galleryDiv.appendChild(btn);
      });

      tabContentDisplay.appendChild(galleryDiv);
    }
    return;

  } else if (tabKey === 'documents') {
    const item = Array.isArray(data) ? data[0] : data;
    const docs = item?.product_documents || [];

    if (docs.length === 0) {
      html = '<p class="tab-empty-msg">No document files available.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      html = `<div class="doc-list-container">` +
        docs.map(d => {
          const roleStr = d?.role ?? 'Document';
          const lenStr = d?.content_length ?? 'PDF Document';
          const titleText = `${roleStr} (${lenStr})`;
          const docUrl = d?.url ?? '#';
          return `
            <a href="${escapeHtml(docUrl)}" target="_blank" rel="noopener" class="doc-item-link" title="Open PDF: ${escapeHtml(titleText)}">
              <div>
                <span class="doc-title-text" title="${escapeHtml(roleStr)}">${escapeHtml(roleStr)}</span>
                <span class="doc-sub-text">${escapeHtml(lenStr)}</span>
              </div>
              <span class="pdf-arrow">PDF &rarr;</span>
            </a>
          `;
        }).join('') +
        `</div>`;
    }

  } else if (tabKey === 'features') {
    const item = Array.isArray(data) ? data[0] : data;
    const features = item?.product_feature || [];

    if (features.length === 0) {
      html = '<p class="tab-empty-msg">No feature highlights available.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      html = `<div class="feature-list-container">` +
        features.map(f => `
          <div class="feature-item-card" title="Feature: ${escapeHtml(f?.feature ?? '')}">
            <div class="feature-item-title" title="${escapeHtml(f?.feature ?? '')}">${escapeHtml(f?.feature ?? '')}</div>
            <div class="feature-item-desc">${escapeHtml(f?.description ?? '')}</div>
          </div>
        `).join('') +
        `</div>`;
    }

  } else if (tabKey === 'certifications') {
    const item = Array.isArray(data) ? data[0] : data;
    const certs = item?.product_certifications || [];

    if (certs.length === 0) {
      html = '<p class="tab-empty-msg">No certification records available.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      html = `<div class="chip-container">` +
        certs.map(c => `<span class="chip-item" title="Certification: ${escapeHtml(c?.certification ?? '')}">${escapeHtml(c?.certification ?? '')}</span>`).join('') +
        `</div>`;
    }

  } else if (tabKey === 'rebates') {
    const rebates = Array.isArray(data) ? data : [data];

    if (rebates.length === 0) {
      html = '<p class="tab-empty-msg">No active rebate programs.</p>';
      markTabEmptyInSession(currentSku, tabKey);
      updateTabPillStylesForSku(currentSku);
    } else {
      html = `<div class="rebate-list-container">` +
        rebates.slice(0, 5).map(r => `
          <div class="rebate-item-card" title="Rebate: ${escapeHtml(r?.name ?? '')}">
            <div class="rebate-card-header">
              <span class="hero-brand-badge">${escapeHtml(r?.source ?? 'NECO')}</span>
              <span class="rebate-type-badge">${escapeHtml(r?.type ?? 'Rebate')}</span>
            </div>
            <div class="rebate-card-title" title="${escapeHtml(r?.name ?? '')}">${escapeHtml(r?.name ?? '')}</div>
            <div class="rebate-date-range">Valid: ${escapeHtml(r?.start_date ?? '')} - ${escapeHtml(r?.end_date ?? '')}</div>
            ${r?.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" class="accessory-inline-link">Download Rebate PDF &rarr;</a>` : ''}
          </div>
        `).join('') +
        `</div>`;
    }

  } else {
    html = `<pre class="json-pre-viewer">${JSON.stringify(data, null, 2)}</pre>`;
  }

  tabContentDisplay.innerHTML = html;
}

async function saveToken() {
  const token = tokenInput.value.trim();
  if (!token) {
    showTokenStatus('Token cannot be empty', false);
    return;
  }

  saveTokenLabel.classList.add('hidden');
  saveTokenSpinner.classList.remove('hidden');
  saveTokenBtn.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'FETCH_DEFAULT_LOOKUP',
      sku: 'JVW5301SJSS',
      matchingRule: 'exact',
      testToken: token
    });

    if (res && res.status === 401) {
      showTokenStatus('Token rejected — check the value and try again.', false);
      await chrome.storage.local.remove(['SKULYTICS_TOKEN', 'SKULYTICS_TOKEN_SET']);
      updateOnboardingState(false);
      return;
    }

    await chrome.storage.local.set({ SKULYTICS_TOKEN: token, SKULYTICS_TOKEN_SET: true });
    tokenInput.value = '';
    tokenInput.placeholder = 'Token configured — enter value to replace';
    showTokenStatus('Token verified and saved!', true);
    updateOnboardingState(true);

    if (!currentSku) {
      initialState.classList.add('hidden');
      switchView('results');
    }

  } catch (err) {
    showTokenStatus(`Verification failed: ${err.message}`, false);
  } finally {
    saveTokenLabel.classList.remove('hidden');
    saveTokenSpinner.classList.add('hidden');
    saveTokenBtn.disabled = false;
  }
}

async function clearToken() {
  await chrome.storage.local.remove(['SKULYTICS_TOKEN', 'SKULYTICS_TOKEN_SET']);
  tokenInput.value = '';
  tokenInput.placeholder = 'Paste bearer token...';
  showTokenStatus('Token cleared', true);
  updateOnboardingState(false);
}

function showTokenStatus(msg, isSuccess) {
  tokenStatusMsg.textContent = msg;
  tokenStatusMsg.className = `status-message ${isSuccess ? 'status-success' : 'danger-btn'}`;
  tokenStatusMsg.classList.remove('hidden');
  setTimeout(() => tokenStatusMsg.classList.add('hidden'), 3500);
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  if (typeof ts === 'string' && isNaN(Number(ts))) return ts;
  const now = Date.now();
  const diff = Math.floor((now - Number(ts)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  const d = new Date(Number(ts));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

let autocompleteSelectedIndex = -1;
let currentAutocompleteMatches = [];

function renderAutocompleteList(query) {
  if (!skuAutocompleteList) return;
  if (!query || query.length < 2) {
    hideAutocomplete();
    return;
  }

  currentAutocompleteMatches = historyItems.filter(i => 
    i.sku.toLowerCase().includes(query.toLowerCase()) ||
    i.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  if (currentAutocompleteMatches.length === 0) {
    hideAutocomplete();
    return;
  }

  autocompleteSelectedIndex = -1;
  skuInput.setAttribute('aria-expanded', 'true');

  skuAutocompleteList.innerHTML = currentAutocompleteMatches.map((m, idx) => `
    <div id="autocomplete-opt-${idx}" class="autocomplete-item" role="option" aria-selected="false" data-sku="${escapeHtml(m.sku)}">
      <span class="autocomplete-sku">${escapeHtml(m.sku)}</span>
      <span class="autocomplete-name">${escapeHtml(m.name || m.brand || '')}</span>
    </div>
  `).join('');

  skuAutocompleteList.classList.remove('hidden');

  skuAutocompleteList.querySelectorAll('.autocomplete-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const sku = item.getAttribute('data-sku');
      skuInput.value = sku;
      hideAutocomplete();
      executeLookup(sku);
    });
    item.addEventListener('mouseenter', () => {
      setAutocompleteHighlight(idx);
    });
  });
}

function hideAutocomplete() {
  if (skuAutocompleteList) {
    skuAutocompleteList.classList.add('hidden');
    skuAutocompleteList.innerHTML = '';
  }
  if (skuInput) {
    skuInput.setAttribute('aria-expanded', 'false');
    skuInput.removeAttribute('aria-activedescendant');
  }
  autocompleteSelectedIndex = -1;
  currentAutocompleteMatches = [];
}

function setAutocompleteHighlight(index) {
  const items = skuAutocompleteList.querySelectorAll('.autocomplete-item');
  items.forEach((item, i) => {
    const isSelected = i === index;
    item.classList.toggle('selected', isSelected);
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
  autocompleteSelectedIndex = index;
  if (index >= 0 && items[index]) {
    skuInput.setAttribute('aria-activedescendant', items[index].id);
  } else {
    skuInput.removeAttribute('aria-activedescendant');
  }
}

function showConfirmModal(title, message) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-modal-ok-btn');
  const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

  if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
    return Promise.resolve(confirm(message));
  }

  titleEl.textContent = title;
  msgEl.textContent = message;
  setupModalFocusTrap(modal, cancelBtn);
  announceLiveRegion(`Confirmation required: ${title}`);

  return new Promise((resolve) => {
    const handleOk = () => {
      cleanup();
      resolve(true);
    };
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCancel();
    };
    const cleanup = () => {
      closeModalHelper(modal);
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      window.removeEventListener('keydown', handleKeyDown);
    };

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    window.addEventListener('keydown', handleKeyDown);
  });
}

const EMPTY_TAB_TTL_MS = 15 * 60 * 1000; // 15-minute session TTL

async function markTabEmptyInSession(sku, tabKey) {
  if (!sku || !tabKey) return;
  try {
    const sessionKey = `EMPTY_TABS_${sku}`;
    const stored = await chrome.storage.session.get([sessionKey]);
    let entry = stored[sessionKey];

    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Date.now() - (entry.timestamp || 0) > EMPTY_TAB_TTL_MS) {
      entry = { timestamp: Date.now(), tabs: [] };
    }

    if (!entry.tabs.includes(tabKey)) {
      entry.tabs.push(tabKey);
      await chrome.storage.session.set({ [sessionKey]: entry });
    }
  } catch (err) {
    console.warn('Failed to store empty tab in session:', err);
  }
}

async function updateTabPillStylesForSku(sku) {
  if (!sku) return;
  try {
    const sessionKey = `EMPTY_TABS_${sku}`;
    const stored = await chrome.storage.session.get([sessionKey]);
    const entry = stored[sessionKey];
    
    const isValid = entry && typeof entry === 'object' && !Array.isArray(entry) && (Date.now() - (entry.timestamp || 0) <= EMPTY_TAB_TTL_MS);
    const emptyTabs = isValid ? (entry.tabs || []) : [];

    tabBtns.forEach(btn => {
      const tabKey = btn.getAttribute('data-tab');
      if (emptyTabs.includes(tabKey)) {
        btn.classList.add('tab-pill-empty');
        btn.title = `${btn.textContent.trim()} (No records available for ${sku})`;
      } else {
        btn.classList.remove('tab-pill-empty');
      }
    });
  } catch (err) {
    console.warn('Failed to update tab pill styles:', err);
  }
}

async function saveHistoryItem(product, statusPayload) {
  const zipcodes = [];
  if (statusPayload && statusPayload.data) {
    for (const item of statusPayload.data) {
      if (item.markets) {
        for (const m of item.markets) {
          if (m.country && m.country.zipcodes) {
            zipcodes.push(...m.country.zipcodes);
          }
        }
      }
    }
  }

  const newItem = {
    sku: product.sku,
    name: product.name || '',
    brand: product.brand?.brand_name || '',
    zipcodes: zipcodes,
    timestamp: Date.now(),
    pinned: false
  };

  const stored = await chrome.storage.local.get(['LOOKUP_HISTORY']);
  let history = stored.LOOKUP_HISTORY || [];

  history = history.filter(h => h.sku !== newItem.sku);
  history.unshift(newItem);

  await chrome.storage.local.set({ LOOKUP_HISTORY: history });
  historyItems = history;
  renderHistoryList();
}

async function renderHistoryList() {
  const stored = await chrome.storage.local.get(['LOOKUP_HISTORY']);
  historyItems = stored.LOOKUP_HISTORY || [];

  // Sort pinned items to the top of history while preserving relative order
  historyItems.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  // Update Pinned Count Badge
  const pinnedCount = historyItems.filter(i => i.pinned).length;
  if (pinnedCountBadge) {
    pinnedCountBadge.textContent = pinnedCount;
    pinnedCountBadge.classList.toggle('hidden', pinnedCount === 0);
  }

  const query = historySearchInput.value.toLowerCase().trim();
  historyListContainer.innerHTML = '';

  const filtered = historyItems.filter(item => {
    if (pinnedOnlyFilter && !item.pinned) return false;
    if (!query) return true;
    return item.sku.toLowerCase().includes(query) ||
           item.name.toLowerCase().includes(query) ||
           item.brand.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    historyListContainer.innerHTML = `<p class="tab-empty-msg">No search history records found.</p>`;
    updateDeleteSelectedBtn();
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.title = `Click to look up SKU: ${item.sku} (${item.name || 'Unnamed'})`;

    // Multi-Select Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'history-item-checkbox';
    checkbox.checked = selectedHistorySkus.has(item.sku);
    checkbox.title = `Select ${item.sku} for bulk action`;
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedHistorySkus.add(item.sku);
      } else {
        selectedHistorySkus.delete(item.sku);
      }
      updateDeleteSelectedBtn();
    });

    const formattedTime = formatRelativeTime(item.timestamp);
    const fullTimeTooltip = (typeof item.timestamp === 'number' || !isNaN(Number(item.timestamp)))
      ? new Date(Number(item.timestamp)).toLocaleString()
      : String(item.timestamp);

    const info = document.createElement('div');
    info.className = 'history-info';
    info.innerHTML = `
      <span class="history-sku">${escapeHtml(item.sku)}</span>
      <span class="history-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name || 'Unnamed Product')} ${item.brand ? `(${escapeHtml(item.brand)})` : ''}</span>
      <span class="history-meta" title="${escapeHtml(fullTimeTooltip)}">${escapeHtml(formattedTime)}</span>
    `;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'history-actions';

    // Pin Toggle Button
    const pinBtn = document.createElement('button');
    pinBtn.className = `pin-btn ${item.pinned ? 'pinned' : ''}`;
    pinBtn.title = item.pinned ? 'Unpin from top' : 'Pin to top of history';
    pinBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="${item.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <path d="M12 17v5M9 2h6l-1 5h3l-2 5H9l-2-5h3L9 2z"></path>
      </svg>
    `;
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePinHistoryItem(item.sku);
    });

    // Delete Single Item Trash Button
    const trashBtn = document.createElement('button');
    trashBtn.className = 'trash-btn';
    trashBtn.title = `Delete ${item.sku} from history`;
    trashBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    trashBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.sku);
    });

    actionsDiv.appendChild(pinBtn);
    actionsDiv.appendChild(trashBtn);

    div.addEventListener('click', () => {
      skuInput.value = item.sku;
      executeLookup(item.sku);
    });

    div.appendChild(checkbox);
    div.appendChild(info);
    div.appendChild(actionsDiv);
    historyListContainer.appendChild(div);
  });

  updateDeleteSelectedBtn();
}

function updateDeleteSelectedBtn() {
  if (selectedHistorySkus.size > 0) {
    const query = historySearchInput.value.toLowerCase().trim();
    const visibleSkus = new Set(
      historyItems.filter(item => {
        if (pinnedOnlyFilter && !item.pinned) return false;
        if (!query) return true;
        return item.sku.toLowerCase().includes(query) ||
               item.name.toLowerCase().includes(query) ||
               item.brand.toLowerCase().includes(query);
      }).map(i => i.sku)
    );

    let hiddenCount = 0;
    selectedHistorySkus.forEach(sku => {
      if (!visibleSkus.has(sku)) hiddenCount++;
    });

    const total = selectedHistorySkus.size;
    deleteSelectedBtn.textContent = hiddenCount > 0
      ? `Delete Selected (${total}) — ${hiddenCount} hidden by filter`
      : `Delete Selected (${total})`;
    deleteSelectedBtn.classList.remove('hidden');
  } else {
    deleteSelectedBtn.classList.add('hidden');
  }
}

async function deleteHistoryItem(sku) {
  const stored = await chrome.storage.local.get(['LOOKUP_HISTORY']);
  let history = stored.LOOKUP_HISTORY || [];
  history = history.filter(item => item.sku !== sku);
  await chrome.storage.local.set({ LOOKUP_HISTORY: history });
  selectedHistorySkus.delete(sku);
  renderHistoryList();
}

async function deleteSelectedHistory() {
  if (selectedHistorySkus.size === 0) return;
  const count = selectedHistorySkus.size;
  const confirmed = await showConfirmModal('Delete Selected History', `Delete ${count} selected history item(s)?`);
  if (!confirmed) return;

  const stored = await chrome.storage.local.get(['LOOKUP_HISTORY']);
  let history = stored.LOOKUP_HISTORY || [];
  history = history.filter(item => !selectedHistorySkus.has(item.sku));

  await chrome.storage.local.set({ LOOKUP_HISTORY: history });
  selectedHistorySkus.clear();
  renderHistoryList();
}

async function clearAllHistory() {
  if (historyItems.length === 0) return;
  const confirmed = await showConfirmModal('Clear All Search History', 'Are you sure you want to clear all search history?');
  if (!confirmed) return;

  await chrome.storage.local.remove('LOOKUP_HISTORY');
  historyItems = [];
  selectedHistorySkus.clear();
  renderHistoryList();
}

async function togglePinHistoryItem(sku) {
  const stored = await chrome.storage.local.get(['LOOKUP_HISTORY']);
  let history = stored.LOOKUP_HISTORY || [];

  history = history.map(item => {
    if (item.sku === sku) {
      return { ...item, pinned: !item.pinned };
    }
    return item;
  });

  await chrome.storage.local.set({ LOOKUP_HISTORY: history });
  renderHistoryList();
}

// ISO 8601 Timestamp Formatter with Local Timezone Offset
function formatIsoWithOffset(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const tzOffset = -d.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const tzH = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzM = pad(Math.abs(tzOffset) % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${sign}${tzH}:${tzM}`;
}

// Filename derivation from image URL
function getFilenameFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const path = new URL(url).pathname;
    const seg = path.split('/').filter(Boolean).pop();
    return seg || url;
  } catch (e) {
    const seg = url.split('/').pop();
    return seg || url;
  }
}

// Evidence Block Plain-Text Summary Generator
function generateEvidenceText() {
  const tabPayload = activeJsonPayload.tab;
  if (!tabPayload || !tabPayload.data) return '';

  const rawData = tabPayload.data;
  const item = Array.isArray(rawData.data) ? rawData.data[0] : (rawData.data || rawData);
  const images = item?.product_images || [];
  const respSku = item?.sku ?? currentSku;
  const respProdId = item?.product_id ?? 'N/A';
  const retrievedDate = formatIsoWithOffset(tabPayload.fetchedAt || Date.now());
  const cacheStatus = tabPayload.cached ? '(from 15-min cache)' : '(live)';
  const endpointPath = tabPayload.endpoint || '/v3/e-commerce/product/assets';

  let text = `SKU queried:         ${currentSku}\n`;
  text += `Endpoint:            GET ${endpointPath}?sku=${encodeURIComponent(currentSku)}\n`;
  text += `Retrieved:           ${retrievedDate} ${cacheStatus}\n`;
  text += `Response sku:        ${respSku}\n`;
  text += `Response product_id: ${respProdId}\n`;
  text += `Images returned:     ${images.length}\n`;

  images.forEach((img, idx) => {
    const filename = getFilenameFromUrl(img.url);
    const sizeStr = img.content_length ? img.content_length : 'N/A';
    const prio = img.priority ?? 0;
    text += `  ${idx + 1}. ${filename}   ${sizeStr}   priority ${prio}\n`;
  });

  return text.trimEnd();
}
