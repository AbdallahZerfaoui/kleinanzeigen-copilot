import { generateMessage, analyzeListing } from "./messageActions.js";
import { getSettings, setSettings } from "../storage.js";

const STRINGS = {
  de: {
    title: "Kleinanzeigen Copilot",
    languageLabel: "Sprache:",
    applicationTypeLabel: "Bewerbungsart:",
    generate: "Nachricht generieren & kopieren",
    generating: "Wird generiert...",
    copied: "Nachricht wurde in die Zwischenablage kopiert.",
    error: "Fehler beim Generieren. Bitte erneut versuchen.",
    analyze: "Anzeige prüfen (Smart Analyst)",
    analyzing: "Prüfe...",
    analysisTitle: "Analyse-Ergebnisse",
    riskLow: "Geringes Risiko",
    riskMedium: "Mittleres Risiko",
    riskHigh: "Hohes Risiko"
  },
  en: {
    title: "Kleinanzeigen Copilot",
    languageLabel: "Language:",
    applicationTypeLabel: "Application type:",
    generate: "Generate & copy",
    generating: "Generating...",
    copied: "Message copied to clipboard.",
    error: "Error while generating. Please try again.",
    analyze: "Analyze Listing (Smart Analyst)",
    analyzing: "Analyzing...",
    analysisTitle: "Analysis Results",
    riskLow: "Low Risk",
    riskMedium: "Medium Risk",
    riskHigh: "High Risk"
  }
};

const DEFAULT_LANGUAGE = "de";

const formatEuros = (value) => (value ? `${value} €` : "–");
const formatSqm = (value) => (value ? `${value} m²` : "–");
const formatRooms = (value) => {
  if (value === null || value === undefined) return "–";
  // Ensure we preserve decimal places
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${numValue} Zimmer`;
};

export async function injectPanel({ listing }) {
  console.log("[UI] injectPanel called with listing:", listing);
  console.log("[UI] listing.rooms:", listing.rooms, "type:", typeof listing.rooms);

  if (document.getElementById("klein-copilot-root")) return;

  const settings = await getSettings();
  let currentLanguage = settings.language || DEFAULT_LANGUAGE;
  let currentGoalType = "single"; // Default to single
  const strings = STRINGS[currentLanguage] || STRINGS[DEFAULT_LANGUAGE];

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
      <span>${strings.title}</span>
      <button id="klein-copilot-close" style="
        border:none;
        background:transparent;
        cursor:pointer;
        font-size:16px;
        line-height:16px;
      ">&times;</button>
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
      <label for="klein-lang-select" style="font-size:12px; color:#444;">${strings.languageLabel}</label>
      <select id="klein-lang-select" style="flex:1;">
        <option value="de"${currentLanguage === "de" ? " selected" : ""}>Deutsch</option>
        <option value="en"${currentLanguage === "en" ? " selected" : ""}>English</option>
      </select>
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
      <label for="klein-goal-select" style="font-size:12px; color:#444;">${strings.applicationTypeLabel}</label>
      <select id="klein-goal-select" style="flex:1;">
        <option value="single"${currentGoalType === "single" ? " selected" : ""}>Single</option>
        <option value="wg"${currentGoalType === "wg" ? " selected" : ""}>WG with friend</option>
        <option value="commercial"${currentGoalType === "commercial" ? " selected" : ""}>Commercial / mixed use</option>
      </select>
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-weight:bold;">${listing.title || "Kein Titel gefunden"}</div>
      <div style="color:#555; font-size:12px; margin-top:2px;">${listing.location || ""}</div>
    </div>
    <div style="margin-bottom:8px;">
      <div><strong>kalt:</strong> ${formatEuros(listing.price_cold)}</div>
      <div><strong>warm:</strong> ${formatEuros(listing.price_warm)}</div>
      <div><strong>Fläche:</strong> ${formatSqm(listing.sqm)}</div>
      <div><strong>Zimmer:</strong> ${formatRooms(listing.rooms)}</div>
      <div><strong>€/m² kalt:</strong> ${listing.price_cold && listing.sqm ? (listing.price_cold / listing.sqm).toFixed(2) + " €/m²" : "–"}</div>
      <div><strong>€/m² warm:</strong> ${listing.price_warm && listing.sqm ? (listing.price_warm / listing.sqm).toFixed(2) + " €/m²" : "–"}</div>
      <div><strong>€/Zimmer warm:</strong> ${(() => {
        if (!listing.price_warm || !listing.rooms) return "–";
        const costPerRoom = listing.price_warm / listing.rooms;
        console.log("[UI] Cost per room calculation:", listing.price_warm, "/", listing.rooms, "=", costPerRoom);
        return costPerRoom.toFixed(2) + " €/Zimmer";
      })()}</div>
    </div>
    <button id="klein-analyze-btn" style="
      padding:6px 10px;
      border-radius:6px;
      border:1px solid #d1d5db;
      background:#f3f4f6;
      color:#374151;
      cursor:pointer;
      font-size:14px;
      width:100%;
      margin-bottom:8px;
    ">
      ${strings.analyze}
    </button>
    <div id="klein-analysis-results" style="display:none; margin-bottom:8px; padding:8px; background:#f9fafb; border-radius:6px; border:1px solid #e5e7eb; font-size:12px;"></div>
    <button id="klein-generate-btn" style="
      padding:6px 10px;
      border-radius:6px;
      border:none;
      background:#2563eb;
      color:white;
      cursor:pointer;
      font-size:14px;
      width:100%;
    ">
      ${strings.generate}
    </button>
    <div id="klein-loading-container" style="display:none; margin-top:8px;">
      <div style="width:100%; height:4px; background:#e5e7eb; border-radius:2px; overflow:hidden;">
        <div id="klein-loading-bar" style="
          width:0%;
          height:100%;
          background:linear-gradient(90deg, #2563eb, #3b82f6, #2563eb);
          background-size:200% 100%;
          animation:klein-loading 1.5s ease-in-out infinite;
          transition:width 0.3s ease;
        "></div>
      </div>
      <div id="klein-loading-text" style="font-size:11px; color:#666; margin-top:4px; text-align:center;">Connecting to OpenRouter API...</div>
    </div>
    <div id="klein-status" style="font-size:12px; color:#555; margin-top:6px;"></div>
    <style>
      @keyframes klein-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    </style>
  `;

  document.body.appendChild(panel);

  const closeBtn = document.getElementById("klein-copilot-close");
  const langSelect = document.getElementById("klein-lang-select");
  const goalSelect = document.getElementById("klein-goal-select");
  const generateBtn = document.getElementById("klein-generate-btn");
  const analyzeBtn = document.getElementById("klein-analyze-btn");
  const analysisResults = document.getElementById("klein-analysis-results");
  const statusEl = document.getElementById("klein-status");

  const refreshStrings = () => STRINGS[currentLanguage] || STRINGS[DEFAULT_LANGUAGE];

  const setStatus = (msg, isError = false) => {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#b91c1c" : "#555";
  };

  closeBtn.addEventListener("click", () => panel.remove());

  langSelect.addEventListener("change", async (e) => {
    currentLanguage = e.target.value;
    await setSettings({ language: currentLanguage });
    const s = refreshStrings();
    generateBtn.textContent = s.generate;
    setStatus("");
  });

  goalSelect.addEventListener("change", (e) => {
    currentGoalType = e.target.value;
    setStatus("");
  });

  generateBtn.addEventListener("click", async () => {
    const s = refreshStrings();
    generateBtn.disabled = true;
    generateBtn.textContent = s.generating;
    setStatus("");

    // Show loading bar
    const loadingContainer = document.getElementById("klein-loading-container");
    const loadingBar = document.getElementById("klein-loading-bar");
    const loadingText = document.getElementById("klein-loading-text");
    loadingContainer.style.display = "block";

    // Simulate progress updates
    const progressSteps = [
      { percent: 20, text: "Connecting to OpenRouter API..." },
      { percent: 40, text: "Sending listing data..." },
      { percent: 60, text: "AI is generating your message..." },
      { percent: 80, text: "Finalizing response..." }
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        const step = progressSteps[currentStep];
        loadingBar.style.width = `${step.percent}%`;
        loadingText.textContent = step.text;
        currentStep++;
      }
    }, 600);

    try {
      const message = await generateMessage({
        listing,
        goalType: currentGoalType,
        language: currentLanguage
      });

      // Complete the progress bar
      clearInterval(progressInterval);
      loadingBar.style.width = "100%";
      loadingText.textContent = "Done! Copying to clipboard...";

      await navigator.clipboard.writeText(message);
      
      // Hide loading bar after a brief moment
      setTimeout(() => {
        loadingContainer.style.display = "none";
        loadingBar.style.width = "0%";
      }, 500);
      
      setStatus(s.copied);
    } catch (err) {
      console.error("[Kleinanzeigen Copilot] Generate error", err);
      clearInterval(progressInterval);
      loadingContainer.style.display = "none";
      loadingBar.style.width = "0%";
      setStatus(`${refreshStrings().error}`, true);
    } finally {
      const sDone = refreshStrings();
      generateBtn.disabled = false;
      generateBtn.textContent = sDone.generate;
    }
  });

  analyzeBtn.addEventListener("click", async () => {
    const s = refreshStrings();
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = s.analyzing;
    analysisResults.style.display = "none";
    setStatus("");

    try {
      const result = await analyzeListing({ listing });
      
      // Render results
      let html = `<div style="font-weight:bold; margin-bottom:4px;">${s.analysisTitle}</div>`;
      
      // Risk Level Badge
      const riskColor = result.summary.risk_level === "high" ? "#ef4444" : 
                        result.summary.risk_level === "medium" ? "#f59e0b" : "#10b981";
      const riskLabel = result.summary.risk_level === "high" ? s.riskHigh :
                        result.summary.risk_level === "medium" ? s.riskMedium : s.riskLow;
      
      html += `<div style="display:inline-block; padding:2px 6px; border-radius:4px; background:${riskColor}; color:white; font-size:11px; font-weight:bold; margin-bottom:6px;">${riskLabel}</div>`;
      html += `<div style="margin-bottom:8px;">${result.summary.explanation}</div>`;

      // Dimensions
      if (result.dimensions) {
        html += `<div style="margin-bottom:8px; padding:6px; background:#fff; border-radius:4px; border:1px solid #eee;">`;
        html += `<div style="font-weight:bold; margin-bottom:4px; font-size:11px; color:#444;">DETAILS</div>`;
        html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:y-2px gap-x-4px; font-size:11px;">`;
        
        const dimLabels = {
          photos: "Photos",
          price_fairness: "Price",
          contract_type: "Contract",
          registration_status: "Anmeldung",
          description_quality: "Desc.",
          landlord_transparency: "Landlord"
        };

        for (const [key, value] of Object.entries(result.dimensions)) {
           html += `<div><span style="color:#666;">${dimLabels[key] || key}:</span> <span style="font-weight:500;">${value}</span></div>`;
        }
        html += `</div></div>`;
      }

      // Flags
      const renderFlags = (flags, color, icon) => {
        if (!flags || flags.length === 0) return "";
        return flags.map(f => `
          <div style="margin-bottom:4px; padding-left:8px; border-left:2px solid ${color};">
            <div style="font-weight:bold; color:${color};">${icon} ${f.type}</div>
            <div>${f.reason}</div>
            <div style="font-style:italic; color:#666; font-size:11px;">"${f.evidence}"</div>
          </div>
        `).join("");
      };

      html += renderFlags(result.red_flags, "#ef4444", "⚠️");
      html += renderFlags(result.yellow_flags, "#f59e0b", "✋");
      html += renderFlags(result.green_flags, "#10b981", "✅");

      // Clarification Questions
      if (result.clarification_questions && result.clarification_questions.length > 0) {
        html += `<div style="margin-top:8px; padding-top:8px; border-top:1px solid #eee;">`;
        html += `<div style="font-weight:bold; margin-bottom:4px; font-size:11px; color:#2563eb;">QUESTIONS TO ASK</div>`;
        html += result.clarification_questions.map(q => `
          <div style="margin-bottom:6px; padding-left:8px; border-left:2px solid #2563eb;">
            <div style="font-weight:bold; color:#1e40af;">❓ ${q.question}</div>
            <div style="font-size:11px; color:#555;">${q.reason}</div>
          </div>
        `).join("");
        html += `</div>`;
      }

      analysisResults.innerHTML = html;
      analysisResults.style.display = "block";

    } catch (error) {
      console.error("Analysis failed:", error);
      setStatus(s.error, true);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = s.analyze;
    }
  });
}
