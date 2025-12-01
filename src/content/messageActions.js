import { getSettings } from "../storage.js";
import { buildPrompt } from "../prompts/index.js";
import { buildAnalysisUserPrompt, ANALYST_SYSTEM_PROMPT } from "../prompts/analyze.js";
import { generateWithOpenRouter } from "../openrouterClient.js";

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
  const model = settings.model || "openrouter/auto";

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

export async function analyzeListing({ listing }) {
  const settings = await getSettings();
  const model = settings.model || "openrouter/auto";

  const prompt = {
    system: ANALYST_SYSTEM_PROMPT,
    user: buildAnalysisUserPrompt(listing)
  };

  try {
    const response = await generateWithOpenRouter({
      apiKey: null,
      model,
      prompt
    });
    
    // Parse JSON response
    // The LLM might return markdown code blocks, so we need to clean it
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch (error) {
    console.error("[Kleinanzeigen Copilot] Analysis failed", error);
    throw error;
  }
}
