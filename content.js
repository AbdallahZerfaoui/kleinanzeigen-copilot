// content.js
// Runs automatically on kleinanzeigen.de pages

console.log("[Kleinanzeigen Copilot] content script loaded");

/**
 * Injects a fixed panel on the right side of the page
 */
function injectPanel() {
  if (document.getElementById("klein-copilot-root")) return;

  const panel = document.createElement("div");
  panel.id = "klein-copilot-root";

  Object.assign(panel.style, {
    position: "fixed",
    top: "80px",
    right: "20px",
    width: "320px",
    maxHeight: "80vh",
    overflowY: "auto",
    background: "white",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "12px",
    zIndex: "999999",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: "14px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
  });

  panel.innerHTML = `
    <div style="font-weight:bold; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <span>Kleinanzeigen Copilot</span>
      <button id="klein-copilot-close" style="
        border:none;
        background:transparent;
        cursor:pointer;
        font-size:16px;
        line-height:16px;
      ">&times;</button>
    </div>
    <div id="klein-copilot-content">
      Lade Daten...
    </div>
  `;

  document.body.appendChild(panel);

  const closeBtn = document.getElementById("klein-copilot-close");
  closeBtn.addEventListener("click", () => {
    panel.remove();
  });
}

/**
 * Try to extract listing data from the current page.
 * You WILL need to tweak the selectors after inspecting Kleinanzeigen DOM.
 */
function getListingData() {
  // 1. Title
  const titleEl =
    document.querySelector("h1") ||
    document.querySelector('[data-testid="ad-title"]');

  let title = titleEl ? titleEl.textContent.trim() : "";
  if (title) {
    title = title.replace(/(?:Reserved|Reserviert)\s*•\s*(?:Deleted|Gelöscht)\s*•\s*/i, "").trim();
  }

  // 2. Grab the whole visible text as a crude fallback
  const fullText = document.body.innerText;

  // 3. Price: handle both "950 €" and "€950" patterns
  const priceSource = document.querySelector("#viewad-price")
    ? document.querySelector("#viewad-price").textContent
    : fullText;
  const priceText = priceSource.replace(/\s+/g, " ");

  const priceMatch =
    priceText.match(/€\s*([\d.,]+)/i) || // € before digits
    priceText.match(/([\d.,]+)\s*€/i);   // digits before €

  const price = priceMatch ? priceMatch[1].replace(/[^\d]/g, "") : null;
  const priceTypeMatch = priceText.match(/pro\s*[\wäöüß]+/i);
  const priceType = priceTypeMatch ? priceTypeMatch[0].toLowerCase() : null;

  // 3bis. extra costs (Nebenkosten) – inspect only addetails rows
  let extraCosts = 0;
  let extraCostsType = null;
  const detailItems = Array.from(document.querySelectorAll(".addetailslist--detail"));

  const parseEuroNumber = (txt) => {
    const m = txt.match(/€\s*([\d.,]+)|([\d.,]+)\s*€/i);
    const numStr = m ? m[1] || m[2] : null;
    return numStr ? parseInt(numStr.replace(/[^\d]/g, ""), 10) : null;
  };

  for (const item of detailItems) {
    const valueEl = item.querySelector(".addetailslist--detail--value");
    const valueText = valueEl ? valueEl.textContent : item.textContent;

    // Clone to strip the value span and isolate the label text
    const clone = item.cloneNode(true);
    const cloneValue = clone.querySelector(".addetailslist--detail--value");
    if (cloneValue) cloneValue.remove();
    const labelText = clone.textContent.toLowerCase();

    const amount = parseEuroNumber(valueText);
    if (amount === null) continue;

    if (/extra\s*costs|nebenkosten|betriebskosten|additional\s*costs/.test(labelText)) {
      extraCosts = amount;
      extraCostsType = "kalt";
      break; // explicit NK found; stop scanning
    }

    // Warm rent figure (e.g., "Warmmiete" or "Rent including utilities") if NK not found yet
    if (!extraCosts && /rent including utilities|warmmiete|inkl\s*nk|inkl\.\s*nebenkosten|inklusive\s*nebenkosten/.test(labelText)) {
      extraCosts = amount;
      extraCostsType = "warm";
      // do not break; a later NK entry should override
    }
  }

  // 4. Size: "50 m²" etc.
  const sqmMatch = fullText.match(/(\d{2,3})\s*m²/i);
  const sqm = sqmMatch ? parseInt(sqmMatch[1], 10) : null;

  // 5. Location – very fuzzy
  let location = "";
  const locationEl =
    document.querySelector('[data-testid="location"]') ||
    document.querySelector(".location");
  if (locationEl) {
    location = locationEl.textContent.trim();
  }

  return {
    title,
    price: price ? parseInt(price, 10) : null,
    priceType,
    extraCosts: extraCosts,
    extraCostsType,
    sqm,
    location
  };
}

/**
 * Derive cold/warm prices and NK depending on what was parsed.
 */
function derivePriceDetails(data) {
  const coldPrice = typeof data.price === "number" ? data.price : null;
  const hasExtra = typeof data.extraCosts === "number";
  const extraType = data.extraCostsType ? data.extraCostsType.toLowerCase() : null;
  const isWarmFigure = hasExtra && extraType === "warm";

  // If the extra figure is warm rent, NK is only derivable when cold is known.
  const nk = hasExtra && !isWarmFigure
    ? data.extraCosts
    : isWarmFigure && coldPrice !== null && data.extraCosts > coldPrice
      ? data.extraCosts - coldPrice
      : null;

  const warmPrice = isWarmFigure
    ? data.extraCosts
    : coldPrice !== null && nk !== null
      ? coldPrice + nk
      : null;

  return { coldPrice, warmPrice, nk };
}

/**
 * Builds a human-readable €/m² and a quick quality label.
 * For now we use hard-coded thresholds; later you can read them from settings.
 */
function evaluateListing(data) {
  const { coldPrice, warmPrice } = derivePriceDetails(data);
  const sqm = data.sqm;

  const priceToUse = warmPrice ?? coldPrice;

  if (!priceToUse || !sqm) {
    return {
      pricePerSqmCold: null,
      pricePerSqmWarm: null,
      label: "Unvollständig",
      comment: "Konnte Preis oder Fläche nicht sicher erkennen."
    };
  }

  const pricePerSqmCold = coldPrice ? coldPrice / sqm : null;
  const pricePerSqmWarm = warmPrice ? warmPrice / sqm : null;

  // Dummy thresholds – adjust to your reality; prefer warm if vorhanden
  const effectivePps = pricePerSqmWarm ?? pricePerSqmCold;
  let label;
  let comment;
  if (effectivePps <= 15) {
    label = "Sehr gut";
    comment = "Preis pro m² sieht stark aus.";
  } else if (effectivePps <= 20) {
    label = "Ok";
    comment = "Preis pro m² ist im Rahmen.";
  } else {
    label = "Teuer";
    comment = "Preis pro m² ist eher hoch.";
  }

  return {
    pricePerSqmCold,
    pricePerSqmWarm,
    label,
    comment
  };
}

/**
 * Returns a simple, static profile for message generation.
 * Later: load this from chrome.storage.
 */
function getProfileText(callback) {
  chrome.storage.sync.get(["profileText"], (result) => {
    if (result.profileText) callback(result.profileText.trim());
    else callback(`
Ich bin Abdallah, Softwareentwickler in Heilbronn.
Nichtraucher, keine Haustiere, ruhiger Mieter.
Stabile Einkünfte, Interesse an längerfristigem Mietverhältnis.
`.trim());
  });
}

/**
 * Build the message text using the listing + your profile.
 */
function buildMessage(data) {
  const profile = getProfileText();

  const titlePart = data.title ? `"${data.title}"` : "Ihre Wohnung";
  const sizePart = data.sqm ? `${data.sqm} m²` : "der Wohnung";
  const pricePart = data.price ? `${data.price} €${data.priceType ? " " + data.priceType : ""}` : "der Miete";

  return `
Hallo,

ich interessiere mich für Ihre Wohnung ${titlePart} (${sizePart}, ${pricePart}).

Kurz zu mir:
${profile}

Über eine Rückmeldung und einen Besichtigungstermin würde ich mich freuen.

Viele Grüße
Abdallah
`.trim();
}

/**
 * Renders the panel content.
 */
function renderOverview() {
  const root = document.getElementById("klein-copilot-content");
  if (!root) return;

  const data = getListingData();
  const { coldPrice, warmPrice, nk } = derivePriceDetails(data);
  const evalResult = evaluateListing(data);

  const coldPriceStr = coldPrice !== null ? `${coldPrice} €${data.priceType ? " " + data.priceType : ""}` : "Unbekannt";
  const extraCostsStr = nk !== null
    ? `${nk} € Nebenkosten`
    : data.extraCostsType === "warm"
      ? "Warmmiete angegeben"
      : "0 € Nebenkosten";
  const warmPriceStr = warmPrice !== null ? `${warmPrice} € (warm)` : "Unbekannt";
  const sqmStr = data.sqm ? `${data.sqm} m²` : "Unbekannt";
  const ppsColdStr = evalResult.pricePerSqmCold
    ? `${evalResult.pricePerSqmCold.toFixed(2)} €/m² kalt`
    : "N/A";
  const ppsWarmStr = evalResult.pricePerSqmWarm
    ? `${evalResult.pricePerSqmWarm.toFixed(2)} €/m² warm`
    : "N/A";

  root.innerHTML = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:bold;">${data.title || "Kein Titel gefunden"}</div>
      <div style="color:#555; font-size:12px; margin-top:2px;">${data.location || ""}</div>
    </div>

    <div style="margin-bottom:8px;">
      <div><strong>Kaltmiete:</strong> ${coldPriceStr}</div>
      <div><strong>Nebenkosten:</strong> ${extraCostsStr}</div>
      <div><strong>Warmmiete:</strong> ${warmPriceStr}</div>
      <div style="margin-top:4px;"><strong>Fläche:</strong> ${sqmStr}</div>
      <div><strong>€/m² kalt:</strong> ${ppsColdStr}</div>
      <div><strong>€/m² warm:</strong> ${ppsWarmStr}</div>
    </div>

    <div style="margin-bottom:8px; padding:8px; border-radius:6px; background:#f5f5f5;">
      <div><strong>Bewertung:</strong> ${evalResult.label}</div>
      <div style="font-size:12px; color:#555;">${evalResult.comment}</div>
    </div>

    <button id="klein-copilot-generate" style="
      padding:6px 10px;
      border-radius:6px;
      border:none;
      background:#2563eb;
      color:white;
      cursor:pointer;
      font-size:14px;
    ">
      Nachricht generieren & kopieren
    </button>

    <div id="klein-copilot-status" style="font-size:12px; color:#555; margin-top:6px;"></div>
  `;

  const btn = document.getElementById("klein-copilot-generate");
  const statusEl = document.getElementById("klein-copilot-status");

  btn.addEventListener("click", () => {
    const msg = buildMessage(data);
    navigator.clipboard.writeText(msg)
      .then(() => {
        statusEl.textContent = "Nachricht in die Zwischenablage kopiert. Einfach ins Kleinanzeigen-Feld einfügen.";
      })
      .catch((err) => {
        console.error("Clipboard error", err);
        statusEl.textContent = "Konnte nicht in die Zwischenablage schreiben. Öffne die Konsole für die Nachricht.";
        console.log("Generated message:\n\n" + msg);
        alert("Hier ist die Nachricht:\n\n" + msg);
      });
  });
}

// Kick everything off
function init() {
  injectPanel();
  renderOverview();
}

// small delay to let the page finish layouting
setTimeout(init, 800);
