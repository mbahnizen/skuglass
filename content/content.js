// Content script for capturing user text selection on active web pages.
// Preserves full untruncated text selection to bypass chrome.contextMenus 32-char limit.

let currentSelection = '';

function updateSelection() {
  const sel = window.getSelection();
  if (sel) {
    currentSelection = sel.toString();
  }
}

// Update selection when selection changes or context menu is triggered
document.addEventListener('selectionchange', updateSelection);
document.addEventListener('contextmenu', updateSelection);

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'GET_SELECTION') {
    updateSelection();
    sendResponse({ selectionText: currentSelection });
  }
  return true;
});
