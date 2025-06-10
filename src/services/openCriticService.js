/**
 * OpenCritic API Service
 * Handles all interactions with the OpenCritic API endpoint
 */

/**
 * Fetches game information from OpenCritic
 * @param {string} gameName - The name of the game to search for
 * @returns {Promise<Object>} - The game data from OpenCritic
 */
export const getGameInfo = async gameName => {
  try {
    // Use the standard API endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.ascendara.app/opencritic/game?name=${encodeURIComponent(gameName)}`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // Check if the response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      throw new Error("API returned non-JSON response");
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch critic data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error in openCriticService:", error);
    throw error;
  }
};

export default {
  getGameInfo,
};
