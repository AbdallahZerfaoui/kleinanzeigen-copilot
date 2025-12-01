import { getSettings } from "../storage.js";
import { buildPrompt } from "../prompts/index.js";
import { buildAnalysisUserPrompt, ANALYST_SYSTEM_PROMPT } from "../prompts/analyze.js";
import { generateWithOpenRouter } from "../openrouterClient.js";
import { CONFIG } from "../config.js";

const DEFAULT_GOAL = "single";

const buildTemplateMessage = ({ listing, profile, language, goalType }) => {
  const greeting = language === "en" ? "Hello," : "Hallo,";
  const intro =
    language === "en"
      ? "I am interested in your listing."
      : "ich interessiere mich für Ihr Inserat.";
  const labelTitle = language === "en" ? "Title" : "Titel";
  const labelSize = language === "en" ? "Size" : "Größe";
  const labelRent = language === "en" ? "Rent" : "Miete";
  const closing =
    language === "en"
      ? "I look forward to your response."
      : "Ich freue mich auf Ihre Rückmeldung.";

  const lines = [
    greeting,
    "",
    `${intro}`,
    `${labelTitle}: ${listing.title || "-"}`,
    `${labelSize}: ${listing.sqm ? `${listing.sqm} m²` : "-"}`,
    `${labelRent}: ${listing.price_cold ? `${listing.price_cold} € kalt` : "-"}`,
    "",
    profile,
    "",
    closing,
    language === "en" ? "Best regards" : "Viele Grüße"
  ];

  return lines.join("\n").trim();
};

export async function generateMessage({ listing, goalType = DEFAULT_GOAL, language = "de" }) {
  const settings = await getSettings();
  const profile = settings.profileText;
  const model = settings.model || CONFIG.MODEL_MESSAGE;

  const prompt = buildPrompt({
    listing,
    profile,
    goalType,
    language
  });

  try {
    // Always try to use OpenRouter (API key is loaded from config.js)
    const message = await generateWithOpenRouter({
      apiKey: null, // Will use config file key
      model,
      prompt
    });

    return message.trim();
  } catch (error) {
    console.error("[Kleinanzeigen Copilot] OpenRouter failed, using template fallback", error);
    // Fallback to template only if API call fails
    return buildTemplateMessage({ listing, profile, language, goalType });
  }
}

export async function analyzeListing({ listing, language = "de" }) {
  const model = CONFIG.MODEL_AUDIT;

  const prompt = {
    system: ANALYST_SYSTEM_PROMPT,
    user: buildAnalysisUserPrompt(listing, language)
  };

  try {
    const response = await generateWithOpenRouter({
      apiKey: null,
      model,
      prompt
    });
    
    let result;
    // Parse JSON response
    // The LLM might return markdown code blocks, so we need to clean it
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = JSON.parse(response);
    }

    // Deterministic Deposit Assessment
    const deposit = listing.deposit;
    const coldRent = listing.price_cold;
    let depositStatus = "unknown";
    let months = null;
    let reason = "";

    if (deposit && coldRent > 0) {
      months = deposit / coldRent;
      // Allow small floating point margin
      if (months <= 2.05) {
        depositStatus = "ok";
        reason = language === "en" 
          ? `Deposit is ${months.toFixed(1)} months cold rent (≤ 2 is standard).`
          : `Kaution beträgt ${months.toFixed(1)} Monatskaltmieten (≤ 2 ist üblich).`;
      } else if (months <= 3.05) {
        depositStatus = "borderline";
        reason = language === "en"
          ? `Deposit is ${months.toFixed(1)} months cold rent (3 is legal max).`
          : `Kaution beträgt ${months.toFixed(1)} Monatskaltmieten (3 ist gesetzl. Maximum).`;
      } else {
        depositStatus = "red_flag";
        reason = language === "en"
          ? `Deposit is ${months.toFixed(1)} months cold rent (> 3 is illegal).`
          : `Kaution beträgt ${months.toFixed(1)} Monatskaltmieten (> 3 ist illegal).`;
      }
    } else {
        reason = language === "en" ? "Deposit amount not found in listing details." : "Kautionshöhe nicht in den Details gefunden.";
    }

    // Inject into result
    if (!result.dimensions) result.dimensions = {};
    result.dimensions.deposit_assessment = {
      status: depositStatus,
      months_cold_rent: months,
      has_upfront_payment: false, 
      upfront_payment_notes: "",
      reason: reason
    };

    return result;
  } catch (error) {
    console.error("[Kleinanzeigen Copilot] Analysis failed", error);
    throw error;
  }
}
