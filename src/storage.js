import { CONFIG } from "./config.js";
import { DEFAULT_PROFILE } from "./defaultProfile.js";

const DEFAULT_SETTINGS = {
  language: "de",
  model: CONFIG.MODEL_MESSAGE,
  autoRunAudit: true
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
    language: settings.language || DEFAULT_SETTINGS.language,
    autoRunAudit: settings.autoRunAudit !== undefined ? settings.autoRunAudit : DEFAULT_SETTINGS.autoRunAudit
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
