import { analyzeListing, generateMessage } from "../content/messageActions.js";
import { DEFAULT_PROFILE } from "../defaultProfile.js";

// DOM Elements
const els = {
  area: document.getElementById("val-area"),
  rooms: document.getElementById("val-rooms"),
  cold: document.getElementById("val-cold"),
  warm: document.getElementById("val-warm"),
  sqmPrice: document.getElementById("val-sqm-price"),
  location: document.getElementById("val-location"),
  btnAudit: document.getElementById("btn-audit"),
  btnGenerate: document.getElementById("btn-generate"),
  output: document.getElementById("output-container"),
  langSelect: document.getElementById("language-select"),
  profileSelect: document.getElementById("profile-select"),
};

let currentListing = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
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

// Formatters
const formatCurrency = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
};

const formatNumber = (val) => {
  if (val === null || val === undefined) return "–";
  return new Intl.NumberFormat('de-DE').format(val);
};

function renderSummary(listing) {
  els.area.textContent = listing.sqm ? `${formatNumber(listing.sqm)} m²` : "–";
  els.rooms.textContent = listing.rooms ? formatNumber(listing.rooms) : "–";
  els.cold.textContent = listing.price_cold ? formatCurrency(listing.price_cold) : "–";
  els.warm.textContent = listing.price_warm ? formatCurrency(listing.price_warm) : "–";
  els.location.textContent = listing.location ? listing.location : "–";

  if (listing.price_cold && listing.sqm) {
    const perSqm = (listing.price_cold / listing.sqm);
    els.sqmPrice.textContent = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(perSqm) + " / m²";
  } else {
    els.sqmPrice.textContent = "–";
  }
}

async function handleAudit() {
  if (!currentListing) return;

  setLoading(true);
  els.output.innerHTML = ""; // Clear previous

  try {
    const result = await analyzeListing({ listing: currentListing });
    renderAuditResult(result);
  } catch (err) {
    console.error(err);
    els.output.innerHTML = `<div style="color: red;">Fehler bei der Analyse: ${err.message}</div>`;
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
    // For now, we use the default profile or whatever is stored. 
    // The profile select is just a placeholder in this implementation unless we wire it up to different stored profiles.
    
    const message = await generateMessage({ 
      listing: currentListing, 
      language: language 
    });
    
    renderMessageResult(message);
  } catch (err) {
    console.error(err);
    els.output.innerHTML = `<div style="color: red;">Fehler bei der Generierung: ${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

function renderAuditResult(data) {
  let html = "";

  // 1. Risk Analysis (Dimensions)
  html += `<div class="section" style="margin-bottom: 16px;">
    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Risiko-Analyse</h3>
    <div style="display: grid; gap: 8px;">`;

  const dimensionMap = {
    photos: { label: "Fotos", icon: "🖼️" },
    price_fairness: { label: "Preis", icon: "💰" },
    contract_type: { label: "Vertrag", icon: "📄" },
    registration_status: { label: "Anmeldung", icon: "🏠" },
    description_quality: { label: "Beschreibung", icon: "📝" },
    landlord_transparency: { label: "Vermieter", icon: "👤" }
  };

  // Handle nested dimensions object
  const dimensions = data.dimensions || data; // Fallback if flat

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
            <span style="font-size: 13px; font-weight: 500;">${meta.label}</span>
          </div>
          <span style="font-size: 12px; font-weight: 600; color: ${statusColor}; text-transform: capitalize;">
            ${value.replace(/_/g, " ")}
          </span>
        </div>
      `;
    }
  }
  html += `</div></div>`;

  // 2. Questions (if available)
  if (data.clarification_questions && Array.isArray(data.clarification_questions) && data.clarification_questions.length > 0) {
    html += `<div class="section" style="margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Fragen an den Vermieter</h3>
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
      <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">Generierte Nachricht</h3>
      <textarea style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; resize: vertical;">${message}</textarea>
      <button id="copy-btn" style="margin-top: 8px; width: 100%; padding: 6px; background: #eee; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">In die Zwischenablage kopieren</button>
    </div>
  `;
  
  document.getElementById("copy-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(message);
    document.getElementById("copy-btn").textContent = "Kopiert!";
    setTimeout(() => document.getElementById("copy-btn").textContent = "In die Zwischenablage kopieren", 2000);
  });
  
  els.output.style.display = "block";
  els.output.style.alignItems = "start";
  els.output.style.justifyContent = "start";
}

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

function showError(msg) {
  els.output.innerHTML = `<div style="color: red;">${msg}</div>`;
}
