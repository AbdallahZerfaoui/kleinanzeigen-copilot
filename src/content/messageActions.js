import { getSettings } from "../storage.js";
import { buildPrompt } from "../prompts/index.js";
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
    // Always try to use OpenRouter (API key is hardcoded in openrouterClient.js)
    const message = await generateWithOpenRouter({
      apiKey: null, // Will use hardcoded key from openrouterClient.js
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
