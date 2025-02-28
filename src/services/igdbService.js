/**
 * IGDB API Service
 * Handles fetching game data from IGDB API
 *
 * Note: IGDB requires a Twitch Client ID and access token
 * https://api-docs.igdb.com/#authentication
 */

// Constants for API
const IGDB_API_URL = "/api/igdb";
const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";

/**
 * Get Twitch access token
 * @returns {Promise<string>} Access token
 */
const getTwitchToken = async (clientId, clientSecret) => {
  try {
    const response = await fetch(
      `${TWITCH_AUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Twitch token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Twitch token:", error);
    throw error;
  }
};

/**
 * Search for a game by name
 * @param {string} gameName - Name of the game to search for
 * @param {string} clientId - Twitch Client ID
 * @param {string} accessToken - Twitch Access Token
 * @returns {Promise<Object>} Game data
 */
const searchGame = async (gameName, clientId, accessToken) => {
  try {
    const response = await fetch(`${IGDB_API_URL}/games`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: `search "${gameName}"; fields name,summary,storyline,rating,cover.url,screenshots.url,genres.name,platforms.name,release_dates.human,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`,
    });

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`);
    }

    const games = await response.json();
    return games.length > 0 ? games[0] : null;
  } catch (error) {
    console.error("Error searching for game:", error);
    return null;
  }
};

/**
 * Get game screenshots
 * @param {number} gameId - IGDB Game ID
 * @param {string} clientId - Twitch Client ID
 * @param {string} accessToken - Twitch Access Token
 * @returns {Promise<Array>} Screenshots array
 */
const getGameScreenshots = async (gameId, clientId, accessToken) => {
  try {
    const response = await fetch(`${IGDB_API_URL}/screenshots`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: `fields *; where game = ${gameId}; limit 10;`,
    });

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting game screenshots:", error);
    return [];
  }
};

/**
 * Format IGDB image URL to get the appropriate size
 * @param {string} url - Original image URL from IGDB
 * @param {string} size - Size of the image (e.g., 'cover_big', 'screenshot_huge')
 * @returns {string} Formatted image URL
 */
const formatImageUrl = (url, size = "screenshot_big") => {
  if (!url) return null;

  // Replace the size in the URL
  // Original URL format: //images.igdb.com/igdb/image/upload/t_thumb/co1wyy.jpg
  return url.replace("t_thumb", `t_${size}`).replace("//", "https://");
};

/**
 * Get game details from IGDB
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with clientId and clientSecret
 * @returns {Promise<Object>} Game details
 */
const getGameDetails = async (gameName, config = {}) => {
  try {
    // Check if we have the required credentials
    if (!config.clientId || !config.clientSecret) {
      console.warn("IGDB credentials not provided");
      return null;
    }

    // Get access token
    const accessToken = await getTwitchToken(config.clientId, config.clientSecret);

    // Search for the game
    const game = await searchGame(gameName, config.clientId, accessToken);

    if (!game) return null;

    // Get screenshots if available
    let screenshots = [];
    if (game.id) {
      screenshots = await getGameScreenshots(game.id, config.clientId, accessToken);
    }

    // Format the cover and screenshot URLs
    if (game.cover && game.cover.url) {
      game.cover.formatted_url = formatImageUrl(game.cover.url, "cover_big");
    }

    if (screenshots && screenshots.length > 0) {
      game.formatted_screenshots = screenshots.map(screenshot => ({
        ...screenshot,
        formatted_url: formatImageUrl(screenshot.url, "screenshot_big"),
      }));
    }

    return game;
  } catch (error) {
    console.error("Error getting game details:", error);
    return null;
  }
};

// Export the service functions
export default {
  getGameDetails,
  formatImageUrl,
};
