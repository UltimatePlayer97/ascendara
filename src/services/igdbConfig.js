/**
 * IGDB API Configuration
 *
 * This file stores the configuration for the IGDB API service.
 * You need to obtain a Twitch Client ID and Client Secret from:
 * https://dev.twitch.tv/console/apps
 */

// Default configuration
const defaultConfig = {
  enabled: false,
  clientId: "",
  clientSecret: "",
  // Cache duration in milliseconds (default: 7 days)
  cacheDuration: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Load IGDB configuration from electron store
 * @returns {Object} IGDB configuration
 */
const loadConfig = async () => {
  try {
    const config = (await window.electron.getStoreValue("igdbConfig")) || {};
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.error("Error loading IGDB config:", error);
    return defaultConfig;
  }
};

/**
 * Save IGDB configuration to electron store
 * @param {Object} config - IGDB configuration to save
 * @returns {Promise<boolean>} Success status
 */
const saveConfig = async config => {
  try {
    await window.electron.setStoreValue("igdbConfig", {
      ...defaultConfig,
      ...config,
    });
    return true;
  } catch (error) {
    console.error("Error saving IGDB config:", error);
    return false;
  }
};

export default {
  defaultConfig,
  loadConfig,
  saveConfig,
};
