/**
 * Torbox API Service
 * Handles authentication and debrid operations with the Torbox API
 */

/**
 * Check if the Torbox service is enabled by verifying if an API key exists
 * @param {Object} settings - The application settings object
 * @returns {boolean} - True if the service is enabled (API key exists)
 */
export const isEnabled = settings => {
  return Boolean(settings?.torboxApiKey);
};

/**
 * Get the API key from settings
 * @param {Object} settings - The application settings object
 * @returns {string|null} - The API key or null if not set
 */
export const getApiKey = settings => {
  return settings?.torboxApiKey || null;
};

export default {
  isEnabled,
  getApiKey,
};
