import { generateMessage, analyzeListing } from "./messageActions.js";
import { getSettings, setSettings } from "../storage.js";

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
          <p class="kc-subtitle">Wohnungsanalyse für Bewerbungen</p>
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
            <span class="kc-summary-label">Fläche</span>
            <span class="kc-summary-value" id="kc-val-area">– m²</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label">Zimmer</span>
            <span class="kc-summary-value" id="kc-val-rooms">–</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label">Kaltmiete</span>
            <span class="kc-summary-value" id="kc-val-cold">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label">Warmmiete</span>
            <span class="kc-summary-value" id="kc-val-warm">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label">€/m² (kalt)</span>
            <span class="kc-summary-value" id="kc-val-sqm-price">– €</span>
          </div>
          <div class="kc-summary-item">
            <span class="kc-summary-label">Ort</span>
            <span class="kc-summary-value" id="kc-val-location">–</span>
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
      <div class="kc-footer">
        Miet-Audit • Beta
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Elements
  const els = {
    area: document.getElementById("kc-val-area"),
    rooms: document.getElementById("kc-val-rooms"),
    cold: document.getElementById("kc-val-cold"),
    warm: document.getElementById("kc-val-warm"),
    sqmPrice: document.getElementById("kc-val-sqm-price"),
    location: document.getElementById("kc-val-location"),
    btnAudit: document.getElementById("kc-btn-audit"),
    btnGenerate: document.getElementById("kc-btn-generate"),
    output: document.getElementById("kc-output-container"),
    langSelect: document.getElementById("kc-language-select"),
    closeBtn: document.getElementById("kc-close-btn")
  };

  // Render Summary
  const renderSummary = (l) => {
    els.area.textContent = l.sqm ? `${formatNumber(l.sqm)} m²` : "–";
    els.rooms.textContent = l.rooms ? formatNumber(l.rooms) : "–";
    els.cold.textContent = l.price_cold ? formatCurrency(l.price_cold) : "–";
    els.warm.textContent = l.price_warm ? formatCurrency(l.price_warm) : "–";
    els.location.textContent = l.location ? l.location : "–";

    if (l.price_cold && l.sqm) {
      const perSqm = (l.price_cold / l.sqm);
      els.sqmPrice.textContent = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(perSqm) + " / m²";
    } else {
      els.sqmPrice.textContent = "–";
    }
  };

  renderSummary(listing);

  // Event Listeners
  els.closeBtn.addEventListener("click", () => panel.remove());

  els.btnAudit.addEventListener("click", async () => {
    setLoading(true);
    els.output.innerHTML = "";
    try {
      const result = await analyzeListing({ listing });
      renderAuditResult(result);
    } catch (err) {
      console.error(err);
      els.output.innerHTML = `<div style="color: red;">Fehler bei der Analyse: ${err.message}</div>`;
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
      renderMessageResult(message);
    } catch (err) {
      console.error(err);
      els.output.innerHTML = `<div style="color: red;">Fehler bei der Generierung: ${err.message}</div>`;
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    if (isLoading) {
      els.btnAudit.disabled = true;
      els.btnGenerate.disabled = true;
      els.btnAudit.textContent = "Analysiere...";
      els.output.innerHTML = '<div style="text-align: center;">Lade Daten...</div>';
    } else {
      els.btnAudit.disabled = false;
      els.btnGenerate.disabled = false;
      els.btnAudit.textContent = "Run Audit";
    }
  }

  function renderAuditResult(data) {
    let html = "";

    // 1. Risk Analysis (Dimensions)
    html += `<div style="margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333;">Risiko-Analyse</h3>
      <div style="display: grid; gap: 8px;">`;

    const dimensionMap = {
      photos: { label: "Fotos", icon: "🖼️" },
      price_fairness: { label: "Preis", icon: "💰" },
      contract_type: { label: "Vertrag", icon: "📄" },
      registration_status: { label: "Anmeldung", icon: "🏠" },
      description_quality: { label: "Beschreibung", icon: "📝" },
      landlord_transparency: { label: "Vermieter", icon: "👤" }
    };

    const dimensions = data.dimensions || data;

    for (const [key, value] of Object.entries(dimensions)) {
      if (dimensionMap[key]) {
        const meta = dimensionMap[key];
        let statusColor = "#6b7280"; // grey
        if (["missing", "suspicious", "high", "weird", "no_registration", "vague"].includes(value)) statusColor = "#ef4444"; // red
        if (["unclear", "average", "limited"].includes(value)) statusColor = "#f59e0b"; // orange
        if (["present", "fair", "long_term", "ok", "detailed", "clear"].includes(value)) statusColor = "#10b981"; // green

        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border: 1px solid #eee; border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${meta.icon}</span>
              <span style="font-size: 13px; font-weight: 500; color: #333;">${meta.label}</span>
            </div>
            <span style="font-size: 12px; font-weight: 600; color: ${statusColor}; text-transform: capitalize;">
              ${value.replace(/_/g, " ")}
            </span>
          </div>
        `;
      }
    }
    html += `</div></div>`;

    // 2. Questions
    if (data.clarification_questions && Array.isArray(data.clarification_questions) && data.clarification_questions.length > 0) {
      html += `<div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333;">Fragen an den Vermieter</h3>
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
          Fazit: ${data.summary.explanation || riskLevel}
        </div>
      `;
    }

    els.output.innerHTML = html;
    els.output.style.display = "block";
    els.output.style.alignItems = "start";
    els.output.style.justifyContent = "start";
  }

  function renderMessageResult(message) {
    els.output.innerHTML = `
      <div style="width: 100%;">
        <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 10px 0; color: #333;">Generierte Nachricht</h3>
        <textarea style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; resize: vertical; font-family: inherit;">${message}</textarea>
        <button id="kc-copy-btn" style="margin-top: 8px; width: 100%; padding: 8px; background: #eee; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; color: #333;">In die Zwischenablage kopieren</button>
      </div>
    `;
    
    document.getElementById("kc-copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(message);
      const btn = document.getElementById("kc-copy-btn");
      btn.textContent = "Kopiert!";
      setTimeout(() => btn.textContent = "In die Zwischenablage kopieren", 2000);
    });
    
    els.output.style.display = "block";
    els.output.style.alignItems = "start";
    els.output.style.justifyContent = "start";
  }
}
