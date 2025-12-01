// Entry point injected by the content script.
// Dynamically imports the extractor and UI to avoid module issues in content scripts.

(async () => {
  try {
    const [{ extractListing }, { injectPanel }] = await Promise.all([
      import(chrome.runtime.getURL("/src/content/extractListing.js")),
      import(chrome.runtime.getURL("/src/content/uiPanel.js"))
    ]);

    const listing = extractListing();
    injectPanel({ listing });

    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "get_listing_data") {
        // Re-extract to ensure fresh data
        const freshListing = extractListing();
        sendResponse(freshListing);
      }
      // Return true to indicate async response (though here it's synchronous, it's good practice if we needed async)
      return true;
    });

  } catch (err) {
    console.error("[Kleinanzeigen Copilot] Failed to init panel", err);
  }
})();
