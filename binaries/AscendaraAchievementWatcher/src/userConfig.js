const path = require("path");
const fs = require("fs").promises;

/**
 * Loads the user settings from Ascendara's settings file.
 * @returns {Promise<Object>} Parsed settings object, or {} on error.
 */
async function getSettings() {
  try {
    const appData = process.env.APPDATA;
    const settingsPath = path.join(appData, "Electron", "ascendarasettings.json");
    const data = await fs.readFile(settingsPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading settings file:", error);
    return {};
  }
}

module.exports = {
  getSettings,
};
