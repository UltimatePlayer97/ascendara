/**
 * Game APIs Configuration
 *
 * This file stores the configuration for multiple game data APIs:
 * - IGDB (via Twitch): https://dev.twitch.tv/console/apps
 * - GiantBomb: https://www.giantbomb.com/api/
 */

import { useSettings } from "../context/SettingsContext";

// Default configuration for all APIs
const defaultConfig = {
  // Cache duration in milliseconds (default: 7 days)
  cacheDuration: 7 * 24 * 60 * 60 * 1000,

  // IGDB/Twitch configuration
  igdb: {
    enabled: false,
    clientId: "",
    clientSecret: "",
  },

  // GiantBomb configuration
  giantbomb: {
    enabled: false,
    apiKey: "",
  },
};

/**
 * Custom hook to get all game API configurations from settings
 * @returns {Object} Configuration for all game APIs
 */
export const useGameApisConfig = () => {
  const { settings } = useSettings();

  // IGDB/Twitch config
  const twitchClientId = settings.twitchClientId || "";
  const twitchSecret = settings.twitchSecret || "";
  const igdbEnabled =
    twitchClientId &&
    twitchSecret &&
    twitchClientId.trim() !== "" &&
    twitchSecret.trim() !== "";

  // GiantBomb config
  const giantBombKey = settings.giantBombKey || "";
  const giantBombEnabled = giantBombKey && giantBombKey.trim() !== "";

  return {
    cacheDuration: defaultConfig.cacheDuration,

    // IGDB/Twitch
    igdb: {
      enabled: igdbEnabled,
      clientId: twitchClientId,
      clientSecret: twitchSecret,
    },

    // GiantBomb
    giantbomb: {
      enabled: giantBombEnabled,
      apiKey: giantBombKey,
    },
  };
};

/**
 * Legacy hook for backward compatibility
 * @returns {Object} IGDB configuration with credentials
 */
export const useIgdbConfig = () => {
  const config = useGameApisConfig();
  return {
    ...defaultConfig.igdb,
    clientId: config.igdb.clientId,
    clientSecret: config.igdb.clientSecret,
    enabled: config.igdb.enabled,
  };
};

/**
 * Load game APIs configuration from electron store
 * @returns {Object} Game APIs configuration
 */
export const loadConfig = async () => {
  try {
    const config = (await window.electron.getStoreValue("gameApisConfig")) || {};
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.error("Error loading game APIs config:", error);
    return defaultConfig;
  }
};

/**
 * Save game APIs configuration to electron store
 * @param {Object} config - Game APIs configuration to save
 * @returns {Promise<boolean>} Success status
 */
export const saveConfig = async config => {
  try {
    await window.electron.setStoreValue("gameApisConfig", {
      ...defaultConfig,
      ...config,
    });
    return true;
  } catch (error) {
    console.error("Error saving game APIs config:", error);
    return false;
  }
};

export default {
  defaultConfig,
  loadConfig,
  saveConfig,
};
