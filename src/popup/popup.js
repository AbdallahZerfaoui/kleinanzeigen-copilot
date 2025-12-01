import { analyzeListing, generateMessage } from "../content/messageActions.js";
import { DEFAULT_PROFILE } from "../defaultProfile.js";

// UI Strings
const UI_STRINGS = {
  de: {
    subtitle: "Wohnungsanalyse für Bewerbungen",
    area: "Fläche",
    rooms: "Zimmer",
    cold: "Kaltmiete",
    warm: "Warmmiete",
    sqm: "€/m² (warm)",
    location: "Ort",
    audit: "Run Audit",
    generate: "Generate Message",
    placeholder: "Audit-Ergebnisse erscheinen hier.",
    footer: "Miet-Audit • Beta",
    riskTitle: "Risiko-Analyse",
    questionsTitle: "Fragen an den Vermieter",
    verdictPrefix: "Fazit: ",
    copy: "In die Zwischenablage kopieren",
    copied: "Kopiert!",
    analyzing: "Analysiere...",
    loading: "Lade Daten...",
    errorAudit: "Fehler bei der Analyse: ",
    errorGen: "Fehler bei der Generierung: ",
    msgTitle: "Generierte Nachricht",
    dimensions: {
      photos: "Fotos",
      price_fairness: "Preis",
      contract_type: "Vertrag",
      registration_status: "Anmeldung",
      description_quality: "Beschreibung",
      landlord_transparency: "Vermieter",
      deposit_assessment: "Kaution & Vorauszahlung",
      landlord_difficulty: "Vermieter-Faktor"
    },
    roomSize: {
      very_spacious: "Sehr großzügig",
      good: "Gut",
      ok: "OK",
      small: "Klein",
      cramped: "Sehr eng",
      unknown: "Unbekannt"
    },
    extra: {
      avgSize: "Ø Raumgröße",
      roomPrice: "Preis pro Zimmer",
      perRoom: "€ / Zimmer",
      perRoomSuffix: "m² / Zimmer"
    }
  },
  en: {
    subtitle: "Apartment analysis for applications",
    area: "Area",
    rooms: "Rooms",
    cold: "Cold Rent",
    warm: "Warm Rent",
    sqm: "€/m² (warm)",
    location: "Location",
    audit: "Run Audit",
    generate: "Generate Message",
    placeholder: "Audit results will appear here.",
    footer: "Rent Audit • Beta",
    riskTitle: "Risk Analysis",
    questionsTitle: "Questions for the Landlord",
    verdictPrefix: "Verdict: ",
    copy: "Copy to clipboard",
    copied: "Copied!",
    analyzing: "Analyzing...",
    loading: "Loading data...",
    errorAudit: "Analysis error: ",
    errorGen: "Generation error: ",
    msgTitle: "Generated Message",
    dimensions: {
      photos: "Photos",
      price_fairness: "Price",
      contract_type: "Contract",
      registration_status: "Registration",
      description_quality: "Description",
      landlord_transparency: "Landlord",
      deposit_assessment: "Deposit & Upfront",
      landlord_difficulty: "Landlord Difficulty"
    },
    roomSize: {
      very_spacious: "Very spacious",
      good: "Good",
      ok: "OK",
      small: "Small",
      cramped: "Cramped",
      unknown: "Unknown"
    },
    extra: {
      avgSize: "Approx. avg room size",
      roomPrice: "Price per room",
      perRoom: "€ / room",
      perRoomSuffix: "m² / room"
    }
  }
};

// DOM Elements
const els = {
  subtitle: document.getElementById("lbl-subtitle"),
  lblArea: document.getElementById("lbl-area"),
  lblRooms: document.getElementById("lbl-rooms"),
  lblCold: document.getElementById("lbl-cold"),
  lblWarm: document.getElementById("lbl-warm"),
  lblSqm: document.getElementById("lbl-sqm"),
  lblLocation: document.getElementById("lbl-location"),
  lblAvgSize: document.getElementById("lbl-avg-size"),
  lblRoomPrice: document.getElementById("lbl-room-price"),
  lblFooter: document.getElementById("lbl-footer"),
  placeholder: document.getElementById("output-placeholder"),
  
  area: document.getElementById("val-area"),
  rooms: document.getElementById("val-rooms"),
  cold: document.getElementById("val-cold"),
  warm: document.getElementById("val-warm"),
  sqmPrice: document.getElementById("val-sqm-price"),
  location: document.getElementById("val-location"),
  
  valAvgRoomSize: document.getElementById("val-avg-room-size"),
  valRoomPrice: document.getElementById("val-room-price"),

  btnAudit: document.getElementById("btn-audit"),
  btnGenerate: document.getElementById("btn-generate"),
  output: document.getElementById("output-container"),
  langSelect: document.getElementById("language-select"),
  profileSelect: document.getElementById("profile-select"),
};

let currentListing = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Set initial language
  updateUILanguage(els.langSelect.value);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("kleinanzeigen.de")) {
      showError("Bitte öffnen Sie eine Kleinanzeigen-Seite.");
      return;
    }

    // Request data from content script
    chrome.tabs.sendMessage(tab.id, { action: "get_listing_data" }, (response) => {
      if (chrome.runtime.lastError) {
        showError("Konnte keine Verbindung zur Seite herstellen. Bitte Seite neu laden.");
        return;
      }
      
      if (response) {
        currentListing = response;
        renderSummary(response);
      } else {
        showError("Keine Daten gefunden.");
      }
    });

  } catch (err) {
    console.error(err);
    showError("Ein Fehler ist aufgetreten.");
  }
});

// Event Listeners
els.btnAudit.addEventListener("click", handleAudit);
els.btnGenerate.addEventListener("click", handleGenerateMessage);
els.langSelect.addEventListener("change", (e) => {
  updateUILanguage(e.target.value);
});

function updateUILanguage(lang) {
  const s = UI_STRINGS[lang] || UI_STRINGS.de;
  
  els.subtitle.textContent = s.subtitle;
  els.lblArea.textContent = s.area;
  els.lblRooms.textContent = s.rooms;
  els.lblCold.textContent = s.cold;
  els.lblWarm.textContent = s.warm;
  els.lblSqm.textContent = s.sqm;
  els.lblLocation.textContent = s.location;
  els.lblAvgSize.textContent = s.extra.avgSize;
  els.lblRoomPrice.textContent = s.extra.roomPrice;
  els.btnAudit.textContent = s.audit;
  els.btnGenerate.textContent = s.generate;
  if (els.placeholder) els.placeholder.textContent = s.placeholder;
  els.lblFooter.textContent = s.footer;

  // Re-render summary to update derived values with new language
  if (currentListing) {
    renderSummary(currentListing);
  }
}

// Formatters
const formatCurrency = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

const formatNumber = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE').format(val);
};

function classifyAvgRoomSize(avg) {
  if (!avg || !Number.isFinite(avg)) return "unknown";
  if (avg > 28) return "very_spacious";
  if (avg > 22) return "good";
  if (avg > 18) return "ok";
  if (avg > 14) return "small";
  return "cramped";
}

function renderSummary(listing) {
  els.area.textContent = listing.sqm ? `${formatNumber(listing.sqm)} m²` : "–";
  els.rooms.textContent = listing.rooms ? formatNumber(listing.rooms) : "–";
  els.cold.textContent = listing.price_cold ? formatCurrency(listing.price_cold) : "–";
  els.warm.textContent = listing.price_warm ? formatCurrency(listing.price_warm) : "–";
  els.location.textContent = listing.location ? listing.location : "–";

  if (listing.price_warm && listing.sqm) {
    const perSqm = (listing.price_warm / listing.sqm);
    els.sqmPrice.textContent = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(perSqm) + " / m²";
  } else {
    els.sqmPrice.textContent = "–";
  }

  // Derived Values
  const lang = els.langSelect.value;
  const s = UI_STRINGS[lang] || UI_STRINGS.de;

  const avgRoomSize = (listing.sqm && listing.rooms && listing.rooms > 0) ? listing.sqm / listing.rooms : null;
  const pricePerRoom = (listing.price_warm && listing.rooms && listing.rooms > 0) ? listing.price_warm / listing.rooms : null;

  if (avgRoomSize) {
    const labelKey = classifyAvgRoomSize(avgRoomSize);
    const label = s.roomSize[labelKey];
    els.valAvgRoomSize.textContent = `${formatNumber(avgRoomSize)} m² (${label})`;
  } else {
    els.valAvgRoomSize.textContent = "–";
  }

  if (pricePerRoom) {
    els.valRoomPrice.textContent = `${Math.round(pricePerRoom)} €`;
  } else {
    els.valRoomPrice.textContent = "–";
  }
}

async function handleAudit() {
  if (!currentListing) return;

  setLoading(true);
  els.output.innerHTML = ""; // Clear previous

  try {
    const lang = els.langSelect.value;
    const result = await analyzeListing({ listing: currentListing, language: lang });
    renderAuditResult(result, lang);
  } catch (err) {
    console.error(err);
    const lang = els.langSelect.value;
    const s = UI_STRINGS[lang] || UI_STRINGS.de;
    els.output.innerHTML = `<div style="color: red;">${s.errorAudit}${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

async function handleGenerateMessage() {
  if (!currentListing) return;

  setLoading(true);
  els.output.innerHTML = "";

  try {
    const language = els.langSelect.value;
    const message = await generateMessage({ 
      listing: currentListing, 
      language: language 
    });
    
    renderMessageResult(message, language);
  } catch (err) {
    console.error(err);
    const lang = els.langSelect.value;
    const s = UI_STRINGS[lang] || UI_STRINGS.de;
    els.output.innerHTML = `<div style="color: red;">${s.errorGen}${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

function renderAuditResult(data, lang) {
  const s = UI_STRINGS[lang] || UI_STRINGS.de;
  let html = "";

  // 1. Risk Analysis (Dimensions)
  html += `<div class="section" style="margin-bottom: 16px;">
    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${s.riskTitle}</h3>
    <div style="display: grid; gap: 8px;">`;

  const dimensionMap = {
    photos: { label: s.dimensions.photos, icon: "🖼️" },
    price_fairness: { label: s.dimensions.price_fairness, icon: "💰" },
    contract_type: { label: s.dimensions.contract_type, icon: "📄" },
    registration_status: { label: s.dimensions.registration_status, icon: "🏠" },
    description_quality: { label: s.dimensions.description_quality, icon: "📝" },
    landlord_transparency: { label: s.dimensions.landlord_transparency, icon: "👤" },
    deposit_assessment: { label: s.dimensions.deposit_assessment, icon: "💸" },
    landlord_difficulty: { label: s.dimensions.landlord_difficulty, icon: "😤" }
  };

  // Handle nested dimensions object
  const dimensions = data.dimensions || data; // Fallback if flat

  for (const [key, value] of Object.entries(dimensions)) {
    if (dimensionMap[key]) {
      const meta = dimensionMap[key];
      let statusColor = "#6b7280"; // grey
      let displayValue = "";

      if (key === 'deposit_assessment' && typeof value === 'object') {
        // Handle Deposit Object
        const status = value.status || "unknown";
        displayValue = status.replace(/_/g, " ");
        
        if (status === 'ok') statusColor = "#10b981"; // green
        else if (status === 'borderline') statusColor = "#f59e0b"; // orange
        else if (status === 'red_flag') statusColor = "#ef4444"; // red
        else statusColor = "#6b7280"; // grey

      } else if (key === 'landlord_difficulty' && typeof value === 'object') {
        // Handle Landlord Difficulty Object
        const label = value.label || "unknown";
        const score = value.score || 0;
        displayValue = label.replace(/_/g, " ");
        
        if (score <= 2) statusColor = "#10b981"; // green
        else if (score === 3) statusColor = "#6b7280"; // neutral grey
        else if (score === 4) statusColor = "#f59e0b"; // orange
        else if (score === 5) statusColor = "#ef4444"; // red

      } else {
        // Handle Standard String Values
        displayValue = String(value).replace(/_/g, " ");
        if (["missing", "suspicious", "high", "weird", "no_registration", "vague"].includes(value)) statusColor = "#ef4444"; // red
        if (["unclear", "average", "limited"].includes(value)) statusColor = "#f59e0b"; // orange
        if (["present", "fair", "long_term", "ok", "detailed", "clear"].includes(value)) statusColor = "#10b981"; // green
      }

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border: 1px solid #eee; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${meta.icon}</span>
            <span style="font-size: 13px; font-weight: 500;">${meta.label}</span>
          </div>
          <span style="font-size: 12px; font-weight: 600; color: ${statusColor}; text-transform: capitalize;">
            ${displayValue}
          </span>
        </div>
      `;
    }
  }
  html += `</div></div>`;

  // 2. Questions (if available)
  if (data.clarification_questions && Array.isArray(data.clarification_questions) && data.clarification_questions.length > 0) {
    html += `<div class="section" style="margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${s.questionsTitle}</h3>
      <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: #374151;">
        ${data.clarification_questions.map(q => {
          // Handle both string array (legacy) and object array (new prompt)
          const text = typeof q === 'string' ? q : q.question;
          return `<li style="margin-bottom: 4px;">${text}</li>`;
        }).join("")}
      </ul>
    </div>`;
  }

  // 3. Verdict (Summary)
  if (data.summary) {
    const riskLevel = data.summary.risk_level || "unknown";
    let verdictClass = "";
    let verdictBg = "#f3f4f6";
    let verdictColor = "#374151";
    let verdictBorder = "#d1d5db";

    if (riskLevel === "low") {
      verdictBg = "#ecfdf5"; verdictColor = "#065f46"; verdictBorder = "#a7f3d0";
    } else if (riskLevel === "medium") {
      verdictBg = "#fffbeb"; verdictColor = "#92400e"; verdictBorder = "#fde68a";
    } else if (riskLevel === "high") {
      verdictBg = "#fef2f2"; verdictColor = "#991b1b"; verdictBorder = "#fecaca";
    }

    html += `
      <div style="padding: 12px 16px; border-radius: 8px; font-weight: 600; text-align: center; margin-top: 20px; background-color: ${verdictBg}; color: ${verdictColor}; border: 1px solid ${verdictBorder};">
        ${s.verdictPrefix}${data.summary.explanation || riskLevel}
      </div>
    `;
  }

  els.output.innerHTML = html;
  els.output.style.display = "block";
  els.output.style.alignItems = "start";
  els.output.style.justifyContent = "start";
}

function renderMessageResult(message, lang) {
  const s = UI_STRINGS[lang] || UI_STRINGS.de;
  els.output.innerHTML = `
    <div style="width: 100%;">
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">${s.msgTitle}</h3>
      <textarea style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; resize: vertical;">${message}</textarea>
      <button id="copy-btn" style="margin-top: 8px; width: 100%; padding: 6px; background: #eee; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${s.copy}</button>
    </div>
  `;
  
  document.getElementById("copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(message);
    document.getElementById("copy-btn").textContent = s.copied;
    setTimeout(() => document.getElementById("copy-btn").textContent = s.copy, 2000);
  });
  
  els.output.style.display = "block";
  els.output.style.alignItems = "start";
  els.output.style.justifyContent = "start";
}

function setLoading(isLoading) {
  const lang = els.langSelect.value;
  const s = UI_STRINGS[lang] || UI_STRINGS.de;
  
  if (isLoading) {
    els.btnAudit.disabled = true;
    els.btnGenerate.disabled = true;
    els.btnAudit.textContent = s.analyzing;
    els.output.innerHTML = `<div style="text-align: center;">${s.loading}</div>`;
  } else {
    els.btnAudit.disabled = false;
    els.btnGenerate.disabled = false;
    els.btnAudit.textContent = s.audit;
  }
}

function showError(msg) {
  els.output.innerHTML = `<div style="color: red;">${msg}</div>`;
}
