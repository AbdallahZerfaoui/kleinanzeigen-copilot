// Extracts listing data from the Kleinanzeigen page.

const cleanText = (text) => (text || "").replace(/\s+/g, " ").trim();

const getDeepestText = (element) => {
  // Recursively find the deepest text content
  if (!element) return "";

  // If element has no children or only text nodes, return its text content
  if (!element.children || element.children.length === 0) {
    return element.textContent || "";
  }

  // Find the deepest child with actual text content
  const textChildren = Array.from(element.children).filter(child =>
    child.textContent && child.textContent.trim()
  );

  if (textChildren.length === 0) {
    return element.textContent || "";
  }

  // Return the text from the last meaningful child
  return textChildren[textChildren.length - 1].textContent || "";
};

const cleanTitle = (text) => {
  if (!text) return "";

  // Split by newlines and filter out status indicator lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => {
    if (!line) return false;

    const lowerLine = line.toLowerCase();
    // Filter out lines that are just status indicators or bullet points
    if (lowerLine.includes('reserved') ||
        lowerLine.includes('deleted') ||
        lowerLine === '•' ||
        /^\s*•\s*$/.test(lowerLine) ||
        /^\s*reserved\s*$/i.test(lowerLine) ||
        /^\s*deleted\s*$/i.test(lowerLine)) {
      return false;
    }

    // Keep lines that look like actual titles (contain letters and are reasonably long)
    return /[a-zA-Z]/.test(line) && line.length > 3;
  });

  // If we have multiple lines, prefer the longest one that's not a status indicator
  if (lines.length > 1) {
    const sortedByLength = lines.sort((a, b) => b.length - a.length);
    return sortedByLength[0];
  }

  // Join remaining lines and clean up
  return lines.join(' ').replace(/\s+/g, ' ').trim();
};

const parseEuro = (text) => {
  if (!text) return null;
  const match = text.match(/€\s*([\d.,]+)|([\d.,]+)\s*€/i);
  const numStr = match ? match[1] || match[2] : null;
  if (!numStr) return null;
  
  let clean = numStr.replace(/[^0-9.,]/g, "");
  
  if (clean.includes(",") && clean.includes(".")) {
    // Mixed separators
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      // 1.234,56 (DE) -> 1234.56
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 (EN) -> 1234.56
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.includes(",")) {
    // Only comma: 12,50 or 1,200
    // Assume DE decimal separator (12,50)
    clean = clean.replace(",", ".");
  } else if (clean.includes(".")) {
    // Only dot: 1.200 or 12.50
    // Assume DE thousands separator (1.200 -> 1200)
    // But check if it looks like a decimal (2 digits at end?)
    // Actually, on Kleinanzeigen DE, dot is almost always thousands.
    clean = clean.replace(/\./g, "");
  }
  
  return parseFloat(clean);
};

const parseSqm = (text) => {
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
  if (!match) return null;
  let numStr = match[1];
  numStr = numStr.replace(",", ".");
  return parseFloat(numStr);
};

const parseRooms = (text) => {
  if (!text) return null;
  // Match patterns like "2 Zimmer", "3 rooms", "2.5 Zimmer", "3.5-room", "3,5 Zimmer"
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*[-]?\s*(zimmer|rooms?|räume|room)/i);
  console.log("[Parse] parseRooms input:", text, "match:", match);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
};

const parseRoomCount = (text) => {
  if (!text) return null;
  // Extract just the number from room count values like "2", "3.5", "3,5"
  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  console.log("[Parse] parseRoomCount input:", text, "match:", match);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
};

export function extractListing() {
  const titleEl =
    document.querySelector("h1") ||
    document.querySelector('[data-testid="ad-title"]');

  let title = "";
  if (titleEl) {
    // Specific handling for Kleinanzeigen title structure
    // Exclude hidden status spans and extract the actual title text
    const statusSpans = titleEl.querySelectorAll('.pvap-reserved-title, .is-hidden');
    const allSpans = titleEl.querySelectorAll('span, font');

    if (allSpans.length > 0) {
      // Filter out status spans and get the actual title spans
      const titleSpans = Array.from(allSpans).filter(span => {
        return !span.classList.contains('pvap-reserved-title') &&
               !span.classList.contains('is-hidden') &&
               span.textContent.trim() &&
               span.textContent.trim().length > 3; // Avoid very short status fragments
      });

      if (titleSpans.length > 0) {
        // Get text from the deepest meaningful element
        const deepestSpan = titleSpans[titleSpans.length - 1];
        title = cleanText(getDeepestText(deepestSpan));
      }
    }

    // Fallback: remove status text from full textContent
    if (!title) {
      const fullText = titleEl.textContent || "";
      // Remove known status patterns
      title = fullText
        .replace(/Reserviert\s*•\s*/gi, '')
        .replace(/Gelöscht\s*•\s*/gi, '')
        .replace(/Nicht mehr verfügbar/gi, '')
        .replace(/\s*•\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

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
  let heatingCosts = null;
  let sqm = null;
  let rooms = null;
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
    } else if (!heatingCosts && (/heizkosten|heating\s*costs/.test(labelText))) {
      heatingCosts = parseEuro(valueText);
    }

    if (!sqm && /wohnfl|living\s*space|fläche/.test(labelText)) {
      sqm = parseSqm(valueText);
    }

    if (!rooms && /zimmer|rooms?|räume|room/i.test(labelText)) {
      // Exclude bedrooms and bathrooms to avoid false positives
      if (/schlaf|bed|bade|bath/i.test(labelText)) {
        return;
      }

      // First try to parse from combined text (for cases like "2 Zimmer")
      rooms = parseRooms(valueText) || parseRooms(labelText + " " + valueText);
      // If that fails, try to parse just the number from the value
      if (!rooms) {
        rooms = parseRoomCount(valueText);
      }
      console.log("[Extract] Structured room extraction - Label:", labelText, "Value:", valueText, "Result:", rooms);
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

  // Fallback rooms from whole page
  if (rooms === null) {
    rooms = parseRooms(document.body.innerText || "");
    console.log("[Extract] Fallback room extraction from page text:", rooms);
  }

  // Derive warm price if possible
  if (priceWarm === null && priceCold !== null) {
    let totalExtra = 0;
    if (extraCosts !== null) totalExtra += extraCosts;
    if (heatingCosts !== null) totalExtra += heatingCosts;
    
    if (totalExtra > 0) {
      priceWarm = priceCold + totalExtra;
    }
  }

  const featureEls = Array.from(
    document.querySelectorAll(
      '[data-testid="feature-tag"], .addetailslist--detail--value .tag, .addetailslist--detail--value .badge, .adtag'
    )
  );
  const features = featureEls
    .map((el) => cleanText(el.textContent))
    .filter(Boolean);

  console.log("[Extract] Final rooms value before return:", rooms, "type:", typeof rooms);

  return {
    title,
    description,
    price_cold: priceCold || 0,
    price_warm: priceWarm || priceCold || 0,
    sqm,
    rooms: rooms !== null ? parseFloat(rooms) : null, // Ensure rooms is always a float
    location,
    features
  };
}
