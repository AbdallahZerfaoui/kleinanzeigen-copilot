// Minimal OpenRouter client for non-streaming completions.

// Hardcoded API key - Replace with your actual OpenRouter API key
const OPENROUTER_API_KEY = "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";

export async function generateWithOpenRouter({ apiKey, model, prompt }) {
  // Use hardcoded key if no key is provided
  const finalApiKey = apiKey || OPENROUTER_API_KEY;
  
  if (!finalApiKey || finalApiKey === "YOUR_API_KEY_HERE") {
    throw new Error("Missing OpenRouter API key. Please add your API key in openrouterClient.js");
  }

  // Handle both old string format and new object format
  let messages;
  if (typeof prompt === 'string') {
    // Legacy format: single string prompt
    messages = [{ role: "user", content: prompt }];
  } else if (prompt.system && prompt.user) {
    // New format: separate system and user messages
    messages = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ];
  } else {
    // Fallback
    messages = [{ role: "user", content: String(prompt) }];
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${finalApiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned no content.");
  }

  return content.trim();
}
