# Kleinanzeigen Copilot 🤖🏠

A Chrome extension that helps you apply for apartments on **Kleinanzeigen.de** faster and safer. It extracts listing details, analyzes risks, and generates personalized application messages in seconds.

## ✨ Features

*   **⚡️ Instant Message Generation**: Creates polite, personalized application messages (German/English) based on the listing details.
*   **🕵️‍♂️ Smart Analyst**: Audits listings for red flags, scams, and missing info (e.g., "No Anmeldung", "Cash only").
*   **📊 Quick Overview**: Shows price per m² and room costs at a glance.
*   **🎯 Custom Profiles**: Tailors messages for Single, WG, or Commercial applications.

## 🚀 Quick Start

1.  **Clone the repo**
    ```bash
    git clone https://github.com/AbdallahZerfaoui/kleinanzeigen-copilot.git
    ```

2.  **Add your API Key**
    *   Get a key from [OpenRouter.ai](https://openrouter.ai/).
    *   Open `src/config.js` and paste your key:
        ```javascript
        export const OPENROUTER_API_KEY = "sk-or-v1-...";
        ```

3.  **Install in Chrome**
    *   Open `chrome://extensions/`
    *   Enable **Developer mode** (top right).
    *   Click **Load unpacked**.
    *   Select the `kleinanzeigen-copilot` folder.

4.  **Use it**
    *   Go to any apartment listing on [Kleinanzeigen.de](https://www.kleinanzeigen.de).
    *   The Copilot panel will appear automatically on the right.
    *   Click **"Analyze Listing"** to check for risks.
    *   Click **"Generate & Copy"** to create your message.

## 🛠 Tech Stack
*   Vanilla JavaScript (ES Modules)
*   Chrome Extension Manifest V3
*   OpenRouter API (LLM)

## ⚠️ Disclaimer
This tool uses AI to generate text and analyze listings. Always verify the information yourself before sending money or signing contracts.
