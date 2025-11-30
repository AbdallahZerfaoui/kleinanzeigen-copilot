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
  } catch (err) {
    console.error("[Kleinanzeigen Copilot] Failed to init panel", err);
  }
})();
