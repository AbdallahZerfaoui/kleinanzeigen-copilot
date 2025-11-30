const DEFAULT_PROFILE = `
Ich bin Abdallah, Softwareentwickler in Heilbronn.
Nichtraucher, keine Haustiere, ruhiger Mieter.
Stabile Einkünfte, Interesse an längerfristigem Mietverhältnis.
`.trim();

const DEFAULT_SETTINGS = {
  language: "de",
  model: "x-ai/grok-4.1-fast"
};

const SETTINGS_KEY = "settings";

const chromeStorage = chrome?.storage?.sync;

const read = (keys) =>
  new Promise((resolve) => {
    if (!chromeStorage) {
      resolve({});
      return;
    }
    chromeStorage.get(keys, (result) => resolve(result || {}));
  });

const write = (obj) =>
  new Promise((resolve) => {
    if (!chromeStorage) {
      resolve();
      return;
    }
    chromeStorage.set(obj, () => resolve());
  });

export async function getSettings() {
  // Allow build-time injection from .env (e.g., via process.env.OPENROUTER_API_KEY)
  const envApiKey =
    typeof process !== "undefined" && process.env
      ? process.env.OPENROUTER_API_KEY
      : "";

  const stored = await read(["profileText", "openRouterApiKey", SETTINGS_KEY]);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };

  return {
    profileText: stored.profileText || DEFAULT_PROFILE,
    openRouterApiKey: envApiKey || stored.openRouterApiKey || "",
    model: settings.model || DEFAULT_SETTINGS.model,
    language: settings.language || DEFAULT_SETTINGS.language
  };
}

export async function setSettings(partial) {
  const stored = await read([SETTINGS_KEY]);
  const merged = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}), ...partial };
  await write({ [SETTINGS_KEY]: merged });
  return merged;
}

export async function setProfileText(profileText) {
  await write({ profileText });
  return profileText;
}
