import { generateMessage } from "./messageActions.js";
import { getSettings, setSettings } from "../storage.js";

const STRINGS = {
  de: {
    title: "Kleinanzeigen Copilot",
    languageLabel: "Sprache:",
    applicationTypeLabel: "Bewerbungsart:",
    generate: "Nachricht generieren & kopieren",
    generating: "Wird generiert...",
    copied: "Nachricht wurde in die Zwischenablage kopiert.",
    error: "Fehler beim Generieren. Bitte erneut versuchen."
  },
  en: {
    title: "Kleinanzeigen Copilot",
    languageLabel: "Language:",
    applicationTypeLabel: "Application type:",
    generate: "Generate & copy",
    generating: "Generating...",
    copied: "Message copied to clipboard.",
    error: "Error while generating. Please try again."
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
}
