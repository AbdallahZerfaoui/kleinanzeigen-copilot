# Kleinanzeigen Copilot 🤖🏠

A Chrome extension that helps you review Kleinanzeigen.de listings, audit risks, and generate polite application messages in seconds.

## ✨ What it does
- **Popup audit UI:** Compact popup (opens from the toolbar) with listing summary, €/m², and aligned labels/values.
- **Smart Analyst:** Runs an audit for scams/red flags (Anmeldung, cash-only, vague landlord, missing info).
- **Message generator:** Creates a concise, polite application message in German or English.
- **Profiles & goals:** Tailors tone for Single, WG, or Commercial goals (goal prompts in `src/prompts`).
- **Live extraction:** Content script re-extracts listing data each time you open the popup to avoid stale values.

## 🚀 Setup
1) **Clone**
```bash
git clone https://github.com/AbdallahZerfaoui/kleinanzeigen-copilot.git
```

2) **Configure OpenRouter API key**
- Get a key at https://openrouter.ai/
- Copy `config.example.js` to `config.js` and fill in:
```js
export const OPENROUTER_API_KEY = "sk-or-v1-...";
```
- Optional: adjust model/temperature settings in `src/openrouterClient.js` or prompt goals in `src/prompts/`.

3) **Load the extension**
- Open `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked** and select the repo folder
- After changes, hit **Reload** on the extension and reopen the popup

## 🧭 How to use
1) Open any listing on https://www.kleinanzeigen.de/s-anzeige/*
2) Click the extension icon to open the popup
3) Review the **Summary** card (area, rooms, cold/warm rent, €/m², location)
4) Pick **Language** and **Profile** (placeholder profiles for now)
5) Click **Run Audit** to see risks and clarifying questions
6) Click **Generate Message** to get a ready-to-send application; copy it from the popup

## 📂 Key files
- `manifest.json` — MV3 manifest, permissions, popup entry
- `src/popup/popup.html|js` — popup UI and actions
- `src/content/main.js` — content-script entry, handles data extraction messaging
- `src/content/extractListing.js` — scrapes price, rooms, sqm, location
- `src/content/messageActions.js` — wraps audit/message calls
- `src/prompts/` — system and goal prompts for message generation
- `src/config.js` — API key and config (create from example)

## ✅ Things to verify before sharing
- API key is set in `src/config.js`
- Extension reloaded after edits (`chrome://extensions` → Reload)
- Popup shows the modern audit UI (no legacy side panel)
- Listing fields populate correctly (no zeros where data is missing)

## 🔄 User workflow (ad → application)
- **1) Open a listing:** Go to any Kleinanzeigen ad (`…/s-anzeige/*`). The content script runs automatically and extracts title, location, cold/warm rent, sqm, rooms, and €/m² (no UI is injected on the page).
- **2) Launch the popup:** Click the extension icon. `src/popup/popup.html|js` loads.
- **3) Fresh data fetch:** The popup sends `get_listing_data` to the active tab. The content script re-runs `extractListing()` and returns the latest values to avoid stale data.
- **4) Review summary:** The popup summary card shows Area, Rooms, Cold/Warm rent, €/m² (kalt), and Location (shortened). Missing fields show “–”.
- **5) Choose context:** Pick Language and Profile (profiles are placeholders unless wired to stored profiles).
- **6) Run audit:** Click **Run Audit**. The popup calls `analyzeListing` (via `src/content/messageActions.js`) using prompts in `src/prompts`, then displays risk levels, flags, and clarifying questions in the output area.
- **7) Generate message:** Click **Generate Message** to create a concise DE/EN application text based on listing data, goal type, and language.
- **8) Apply:** Copy the generated message from the popup and paste it into Kleinanzeigen’s message form on the ad page.

## ⚠️ Disclaimer
This tool uses AI to generate text and analyze listings. Always verify information before sending money or signing contracts. You are responsible for how you use the output.
