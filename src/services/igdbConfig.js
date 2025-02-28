/**
 * IGDB API Configuration
 *
 * This file stores the configuration for the IGDB API service.
 * You need to obtain a Twitch Client ID and Client Secret from:
 * https://dev.twitch.tv/console/apps
 */

import { useSettings } from "../context/SettingsContext";

// Default configuration
const defaultConfig = {
  enabled: false,
  clientId: "",
  clientSecret: "",
  // Cache duration in milliseconds (default: 7 days)
  cacheDuration: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Custom hook to get IGDB configuration with Twitch credentials from settings
 * @returns {Object} IGDB configuration with credentials
 */
export const useIgdbConfig = () => {
  const { settings } = useSettings();
  const twitchClientId = settings.twitchClientId || "";
  const twitchSecret = settings.twitchSecret || "";

  // Check if both credentials are set
  const credentialsSet =
    twitchClientId &&
    twitchSecret &&
    twitchClientId.trim() !== "" &&
    twitchSecret.trim() !== "";
  console.log("Credentials set:", credentialsSet);
  return {
    ...defaultConfig,
    clientId: twitchClientId,
    clientSecret: twitchSecret,
    enabled: credentialsSet,
  };
};

/**
 * Load IGDB configuration from electron store
 * @returns {Object} IGDB configuration
 */
export const loadConfig = async () => {
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
export const saveConfig = async config => {
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
