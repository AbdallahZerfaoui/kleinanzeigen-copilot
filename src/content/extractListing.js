// Extracts listing data from the Kleinanzeigen page.

const cleanText = (text) => (text || "").replace(/\s+/g, " ").trim();

const parseEuro = (text) => {
  if (!text) return null;
  const match = text.match(/€\s*([\d.,]+)|([\d.,]+)\s*€/i);
  const numStr = match ? match[1] || match[2] : null;
  return numStr ? parseInt(numStr.replace(/[^\d]/g, ""), 10) : null;
};

const parseSqm = (text) => {
  if (!text) return null;
  const match = text.match(/(\d{2,4})\s*m²/i);
  return match ? parseInt(match[1], 10) : null;
};

export function extractListing() {
  const titleEl =
    document.querySelector("h1") ||
    document.querySelector('[data-testid="ad-title"]');
  const title = cleanText(titleEl ? titleEl.textContent : "");

  const descEl = document.querySelector('[data-testid="ad-description"]');
  const description = cleanText(
    descEl ? descEl.textContent : document.body.innerText || ""
  );

  const locationEl =
    document.querySelector('[data-testid="location"]') ||
    document.querySelector(".location");
  const location = cleanText(locationEl ? locationEl.textContent : "");

  let priceCold = null;
  let priceWarm = null;
  let extraCosts = null;
  let sqm = null;
  const detailItems = Array.from(
    document.querySelectorAll(".addetailslist--detail")
  );

  detailItems.forEach((item) => {
    const valueEl = item.querySelector(".addetailslist--detail--value");
    const valueText = cleanText(valueEl ? valueEl.textContent : item.textContent);

    const clone = item.cloneNode(true);
    const cloneValue = clone.querySelector(".addetailslist--detail--value");
    if (cloneValue) cloneValue.remove();
    const labelText = cleanText(clone.textContent).toLowerCase();

    if (!priceCold && (/kaltmiete|cold\s*rent/.test(labelText))) {
      priceCold = parseEuro(valueText);
    } else if (!priceWarm && (/warmmiete|rent including utilities/.test(labelText))) {
      priceWarm = parseEuro(valueText);
    } else if (!extraCosts && (/extra\s*costs|nebenkosten|betriebskosten|additional\s*costs/.test(labelText))) {
      extraCosts = parseEuro(valueText);
    }

    if (!sqm && /wohnfl|living\s*space|fläche/.test(labelText)) {
      sqm = parseSqm(valueText);
    }
  });

  // Fallback price cold from main price element
  if (priceCold === null) {
    const priceText = cleanText(
      document.querySelector("#viewad-price")
        ? document.querySelector("#viewad-price").textContent
        : ""
    );
    priceCold = parseEuro(priceText);
  }

  // Fallback sqm from whole page
  if (sqm === null) {
    sqm = parseSqm(document.body.innerText || "");
  }

  // Derive warm price if possible
  if (priceWarm === null && priceCold !== null && extraCosts !== null) {
    priceWarm = priceCold + extraCosts;
  }

  const featureEls = Array.from(
    document.querySelectorAll(
      '[data-testid="feature-tag"], .addetailslist--detail--value .tag, .addetailslist--detail--value .badge, .adtag'
    )
  );
  const features = featureEls
    .map((el) => cleanText(el.textContent))
    .filter(Boolean);

  return {
    title,
    description,
    price_cold: priceCold || 0,
    price_warm: priceWarm || priceCold || 0,
    sqm,
    location,
    features
  };
}
