import { generateMessage, analyzeListing } from "./messageActions.js";
import { getSettings, setSettings } from "../storage.js";

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

// Formatters
const formatCurrency = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

const formatNumber = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE').format(val);
};

export async function injectPanel({ listing }) {
  if (document.getElementById("klein-copilot-root")) return;

  const panel = document.createElement("div");
  panel.id = "klein-copilot-root";
  
  // Shadow DOM would be better, but let's stick to simple injection for now with scoped styles
  // We use a high z-index and fixed positioning
  Object.assign(panel.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    width: "480px",
    maxHeight: "90vh",
    overflowY: "auto",
    zIndex: "9999999",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    borderRadius: "8px",
    background: "transparent", // The container inside will have the background
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  });

  // CSS from popup.html, slightly adapted
  const styles = `
    <style>
      #klein-copilot-root * {
        box-sizing: border-box;
      }
      
      .kc-container {
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        color: #333;
        font-size: 14px;
        line-height: 1.5;
      }

      .kc-header {
        margin-bottom: 16px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .kc-h1 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 500;
        color: #333;
      }

      .kc-subtitle {
        margin: 0;
        font-size: 13px;
        color: #5f6368;
      }

      .kc-close-btn {
        background: transparent;
        border: none;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        color: #999;
        padding: 0;
      }
      .kc-close-btn:hover { color: #333; }

      .kc-settings-row {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        background: #f7f7f7;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
      }

      .kc-select-wrapper {
        flex: 1;
        position: relative;
      }

      .kc-select {
        width: 100%;
        padding: 8px 10px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid #ddd;
        border-radius: 6px;
        background-color: #ffffff;
        color: #333;
        appearance: none;
        cursor: pointer;
      }

      .kc-select-wrapper::after {
        content: "▼";
        font-size: 10px;
        color: #5f6368;
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
      }

      .kc-summary-card {
        background-color: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        margin-bottom: 16px;
      }

      .kc-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 24px;
      }

      .kc-summary-item {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        font-size: 14px;
      }

      .kc-summary-label {
        color: #333;
        font-weight: 600;
        font-size: 13px;
      }

      .kc-summary-value {
        font-weight: 600;
        color: #333;
        text-align: right;
      }

      .kc-action-card {
        background-color: #f7f7f7;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .kc-btn {
        width: 100%;
        padding: 12px 14px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
        text-align: center;
        border: none;
      }

      .kc-btn-primary {
        background-color: #3b82f6;
        color: white;
        border: 1px solid #3b82f6;
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.18);
      }

      .kc-btn-primary:hover {
        background-color: #2563eb;
        border-color: #2563eb;
      }

      .kc-btn-secondary {
        background-color: transparent;
        color: #333;
        border: 1px solid #ddd;
      }

      .kc-btn-secondary:hover {
        background-color: #ffffff;
        border-color: #c9ced6;
      }

      #kc-output-container {
        min-height: 110px;
        border: 1px dashed #ddd;
        border-radius: 8px;
        background-color: #fafafa;
        margin-bottom: 16px;
        padding: 16px;
        color: #5f6368;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .kc-footer {
        text-align: center;
        font-size: 11px;
        color: #8c8f94;
        padding-top: 12px;
        border-top: 1px solid #ddd;
      }
    </style>
  `;

  panel.innerHTML = `
    ${styles}
    <div class="kc-container">
      <!-- Header -->
      <div class="kc-header">
        <div>
          <h1 class="kc-h1">Classifieds Copilot</h1>
          <p class="kc-subtitle" id="kc-lbl-subtitle">Wohnungsanalyse für Bewerbungen</p>
        </div>
        <button id="kc-close-btn" class="kc-close-btn">&times;</button>
      </div>

      <!-- Settings Row -->
      <div class="kc-settings-row">
        <div class="kc-select-wrapper">
          <select id="kc-language-select" class="kc-select">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="kc-select-wrapper">
          <select id="kc-profile-select" class="kc-select">
            <option value="default">Standard Profil</option>
            <option value="student">Student</option>
            <option value="couple">Paar</option>
          </select>
        </div>
      </div>

      <!-- Property Summary Card -->
      <div class="kc-summary-card">
        <div class="kc-summary-grid">
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-area">Fläche</span>
            <span class="kc-summary-value" id="kc-val-area">– m²</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-rooms">Zimmer</span>
            <span class="kc-summary-value" id="kc-val-rooms">–</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-cold">Kaltmiete</span>
            <span class="kc-summary-value" id="kc-val-cold">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-warm">Warmmiete</span>
            <span class="kc-summary-value" id="kc-val-warm">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-sqm">€/m² (warm)</span>
            <span class="kc-summary-value" id="kc-val-sqm-price">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-location">Ort</span>
            <span class="kc-summary-value" id="kc-val-location">–</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-avg-size">Ø Raumgröße</span>
            <span class="kc-summary-value" id="kc-val-avg-room-size">–</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label" id="kc-lbl-room-price">Preis pro Zimmer</span>
            <span class="kc-summary-value" id="kc-val-room-price">–</span>
          </div>
        </div>
      </div>

      <!-- Primary Action Card -->
      <div class="kc-action-card">
        <button id="kc-btn-audit" class="kc-btn kc-btn-primary">Run Audit</button>
        <button id="kc-btn-generate" class="kc-btn kc-btn-secondary">Generate Message</button>
      </div>

      <!-- Output Container -->
      <div id="kc-output-container">
        Audit results will appear here.
      </div>

      <!-- Footer -->
      <div class="kc-footer" id="kc-lbl-footer">
        Miet-Audit • Beta
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Elements
  const els = {
    subtitle: document.getElementById("kc-lbl-subtitle"),
    lblArea: document.getElementById("kc-lbl-area"),
    lblRooms: document.getElementById("kc-lbl-rooms"),
    lblCold: document.getElementById("kc-lbl-cold"),
    lblWarm: document.getElementById("kc-lbl-warm"),
    lblSqm: document.getElementById("kc-lbl-sqm"),
    lblLocation: document.getElementById("kc-lbl-location"),
    lblAvgSize: document.getElementById("kc-lbl-avg-size"),
    lblRoomPrice: document.getElementById("kc-lbl-room-price"),
    lblFooter: document.getElementById("kc-lbl-footer"),
    
    area: document.getElementById("kc-val-area"),
    rooms: document.getElementById("kc-val-rooms"),
    cold: document.getElementById("kc-val-cold"),
    warm: document.getElementById("kc-val-warm"),
    sqmPrice: document.getElementById("kc-val-sqm-price"),
    location: document.getElementById("kc-val-location"),
    
    valAvgRoomSize: document.getElementById("kc-val-avg-room-size"),
    valRoomPrice: document.getElementById("kc-val-room-price"),

    btnAudit: document.getElementById("kc-btn-audit"),
    btnGenerate: document.getElementById("kc-btn-generate"),
    output: document.getElementById("kc-output-container"),
    langSelect: document.getElementById("kc-language-select"),
    closeBtn: document.getElementById("kc-close-btn")
  };

  function classifyAvgRoomSize(avg) {
    if (!avg || !Number.isFinite(avg)) return "unknown";
    if (avg > 28) return "very_spacious";
    if (avg > 22) return "good";
    if (avg > 18) return "ok";
    if (avg > 14) return "small";
    return "cramped";
  }

  // Render Summary
  const renderSummary = (l) => {
    els.area.textContent = l.sqm ? `${formatNumber(l.sqm)} m²` : "–";
    els.rooms.textContent = l.rooms ? formatNumber(l.rooms) : "–";
    els.cold.textContent = l.price_cold ? formatCurrency(l.price_cold) : "–";
    els.warm.textContent = l.price_warm ? formatCurrency(l.price_warm) : "–";
    els.location.textContent = l.location ? l.location : "–";

    if (l.price_warm && l.sqm) {
      const perSqm = (l.price_warm / l.sqm);
      els.sqmPrice.textContent = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(perSqm) + " / m²";
    } else {
      els.sqmPrice.textContent = "–";
    }

    // Derived Values
    const lang = els.langSelect.value;
    const s = UI_STRINGS[lang] || UI_STRINGS.de;

    const avgRoomSize = (l.sqm && l.rooms && l.rooms > 0) ? l.sqm / l.rooms : null;
    const pricePerRoom = (l.price_warm && l.rooms && l.rooms > 0) ? l.price_warm / l.rooms : null;

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
  };

  renderSummary(listing);

  // Language Handling
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
    if (els.output.textContent.trim() === UI_STRINGS.de.placeholder || els.output.textContent.trim() === UI_STRINGS.en.placeholder) {
      els.output.textContent = s.placeholder;
    }
    els.lblFooter.textContent = s.footer;

    // Re-render summary to update derived values with new language
    renderSummary(listing);
  }

  // Initialize Language
  updateUILanguage(els.langSelect.value);

  // Event Listeners
  els.closeBtn.addEventListener("click", () => panel.remove());
  
  els.langSelect.addEventListener("change", (e) => {
    updateUILanguage(e.target.value);
  });

  els.btnAudit.addEventListener("click", async () => {
    setLoading(true);
    els.output.innerHTML = "";
    try {
      const lang = els.langSelect.value;
      const result = await analyzeListing({ listing, language: lang });
      renderAuditResult(result, lang);
    } catch (err) {
      console.error(err);
      const lang = els.langSelect.value;
      const s = UI_STRINGS[lang] || UI_STRINGS.de;
      els.output.innerHTML = `<div style="color: red;">${s.errorAudit}${err.message}</div>`;
    } finally {
      setLoading(false);
    }
  });

  els.btnGenerate.addEventListener("click", async () => {
    setLoading(true);
    els.output.innerHTML = "";
    try {
      const language = els.langSelect.value;
      const message = await generateMessage({ listing, language });
      renderMessageResult(message, language);
    } catch (err) {
      console.error(err);
      const lang = els.langSelect.value;
      const s = UI_STRINGS[lang] || UI_STRINGS.de;
      els.output.innerHTML = `<div style="color: red;">${s.errorGen}${err.message}</div>`;
    } finally {
      setLoading(false);
    }
  });

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

  function renderAuditResult(data, lang) {
    const s = UI_STRINGS[lang] || UI_STRINGS.de;
    let html = "";

    // 1. Risk Analysis (Dimensions)
    html += `<div style="margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333;">${s.riskTitle}</h3>
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

    const dimensions = data.dimensions || data;

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
              <span style="font-size: 13px; font-weight: 500; color: #333;">${meta.label}</span>
            </div>
            <span style="font-size: 12px; font-weight: 600; color: ${statusColor}; text-transform: capitalize;">
              ${displayValue}
            </span>
          </div>
        `;
      }
    }
    html += `</div></div>`;

    // 2. Questions
    if (data.clarification_questions && Array.isArray(data.clarification_questions) && data.clarification_questions.length > 0) {
      html += `<div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333;">${s.questionsTitle}</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: #374151;">
          ${data.clarification_questions.map(q => {
            const text = typeof q === 'string' ? q : q.question;
            return `<li style="margin-bottom: 4px;">${text}</li>`;
          }).join("")}
        </ul>
      </div>`;
    }

    // 3. Verdict
    if (data.summary) {
      const riskLevel = data.summary.risk_level || "unknown";
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
        <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 10px 0; color: #333;">${s.msgTitle}</h3>
        <textarea style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; resize: vertical; font-family: inherit;">${message}</textarea>
        <button id="kc-copy-btn" style="margin-top: 8px; width: 100%; padding: 8px; background: #eee; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; color: #333;">${s.copy}</button>
      </div>
    `;
    
    document.getElementById("kc-copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(message);
      const btn = document.getElementById("kc-copy-btn");
      btn.textContent = s.copied;
      setTimeout(() => btn.textContent = s.copy, 2000);
    });
    
    els.output.style.display = "block";
    els.output.style.alignItems = "start";
    els.output.style.justifyContent = "start";
  }
}
