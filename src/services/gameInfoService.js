/**
 * Game Data Service
 * Handles fetching game data from multiple APIs:
 * - IGDB (via Twitch): https://api-docs.igdb.com/#authentication
 * - GiantBomb: https://www.giantbomb.com/api/
 */

// Import cache service
import gameApiCache from "./gameInfoCacheService";

// Constants for APIs
const isDev = process.env.NODE_ENV === "development";

// IGDB API endpoints
const IGDB_API_URL = isDev ? "/api/igdb" : "https://api.igdb.com/v4";
const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";

// GiantBomb API endpoints
const GIANTBOMB_API_URL = "https://www.giantbomb.com/api";

/**
 * Get Twitch access token for IGDB
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
 * Search for a game by name using IGDB
 * @param {string} gameName - Name of the game to search for
 * @param {string} clientId - Twitch Client ID
 * @param {string} accessToken - Twitch Access Token
 * @returns {Promise<Object>} Game data
 */
const searchGameIGDB = async (gameName, clientId, accessToken) => {
  try {
    const headers = {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    if (!isDev) {
      headers["Access-Control-Allow-Origin"] = "*";
    }

    // Ensure we're using a properly formed URL
    const url = `${IGDB_API_URL}/games`;
    console.log("IGDB API URL:", url); // Debug log

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: `search "${gameName}"; fields name,summary,storyline,rating,cover.url,screenshots.url,genres.name,platforms.name,release_dates.human,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`,
    });

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`);
    }

    const games = await response.json();
    return games.length > 0 ? games[0] : null;
  } catch (error) {
    console.error("Error searching for game on IGDB:", error);
    return null;
  }
};

/**
 * Get game screenshots from IGDB
 * @param {number} gameId - IGDB Game ID
 * @param {string} clientId - Twitch Client ID
 * @param {string} accessToken - Twitch Access Token
 * @returns {Promise<Array>} Screenshots array
 */
const getGameScreenshotsIGDB = async (gameId, clientId, accessToken) => {
  try {
    const headers = {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // In production, we need to add CORS headers
    if (!isDev) {
      headers["Access-Control-Allow-Origin"] = "*";
    }

    // Ensure we're using a properly formed URL
    const url = `${IGDB_API_URL}/screenshots`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: `fields *; where game = ${gameId}; limit 10;`,
    });

    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting game screenshots from IGDB:", error);
    return [];
  }
};

/**
 * Search for a game by name using GiantBomb
 * @param {string} gameName - Name of the game to search for
 * @param {string} apiKey - GiantBomb API Key
 * @returns {Promise<Object>} Game data
 */
const searchGameGiantBomb = async (gameName, apiKey) => {
  try {
    // URL encode the game name
    const encodedGameName = encodeURIComponent(gameName);
    const url = `${GIANTBOMB_API_URL}/search/?api_key=${apiKey}&format=json&query=${encodedGameName}&resources=game&limit=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`GiantBomb API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error("Error searching for game on GiantBomb:", error);
    return null;
  }
};

/**
 * Get detailed game info from GiantBomb by ID
 * @param {string} gameId - GiantBomb Game ID/GUID
 * @param {string} apiKey - GiantBomb API Key
 * @returns {Promise<Object>} Detailed game data
 */
const getGameDetailByIdGiantBomb = async (gameId, apiKey) => {
  try {
    const url = `${GIANTBOMB_API_URL}/game/${gameId}/?api_key=${apiKey}&format=json`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`GiantBomb API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results) {
      return data.results;
    }

    return null;
  } catch (error) {
    console.error("Error getting game details from GiantBomb:", error);
    return null;
  }
};

/**
 * Format IGDB image URL to get the appropriate size
 * @param {string} url - Original image URL from IGDB
 * @param {string} size - Size of the image (e.g., 'cover_big', 'screenshot_huge')
 * @returns {string} Formatted image URL
 */
const formatIgdbImageUrl = (url, size = "screenshot_big") => {
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
const getGameDetailsIGDB = async (gameName, config = {}) => {
  try {
    // Check if we have this game in cache first
    const cachedData = gameApiCache.getCachedGame(gameName, "igdb");
    if (cachedData) {
      console.log(`Using cached IGDB data for: ${gameName}`);
      return cachedData;
    }

    console.log(`Fetching IGDB data for: ${gameName}`);

    // Extract config values
    const { clientId, clientSecret, enabled = true } = config;

    // Skip if not enabled or missing credentials
    if (!enabled || !clientId || !clientSecret) {
      console.log("IGDB integration is not enabled or missing credentials");
      return null;
    }

    // Get access token
    const accessToken = await getTwitchToken(clientId, clientSecret);

    // Search for the game
    const game = await searchGameIGDB(gameName, clientId, accessToken);

    if (!game) {
      return null;
    }

    // Process the game data
    const gameDetails = {
      id: game.id,
      name: game.name,
      summary: game.summary,
      storyline: game.storyline,
      rating: game.rating,
      cover: game.cover,
      screenshots: game.screenshots || [],
      genres: game.genres || [],
      platforms: game.platforms || [],
      release_date: game.release_dates?.[0]?.human,
    };

    // Extract developers and publishers
    if (game.involved_companies) {
      gameDetails.developers = game.involved_companies
        .filter(company => company.developer)
        .map(company => company.company.name);

      gameDetails.publishers = game.involved_companies
        .filter(company => company.publisher)
        .map(company => company.company.name);
    }

    // Get additional screenshots if needed
    if (game.screenshots?.length < 3 && game.id) {
      const additionalScreenshots = await getGameScreenshotsIGDB(
        game.id,
        clientId,
        accessToken
      );

      if (additionalScreenshots.length > 0) {
        gameDetails.screenshots = additionalScreenshots;
      }
    }

    // Cache the processed game data
    gameApiCache.cacheGame(gameName, gameDetails, "igdb");

    return gameDetails;
  } catch (error) {
    console.error("Error getting game details from IGDB:", error);
    return null;
  }
};

/**
 * Get game details from GiantBomb
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with apiKey
 * @returns {Promise<Object>} Game details
 */
const getGameDetailsGiantBomb = async (gameName, config = {}) => {
  try {
    // Check if we have this game in cache first
    const cachedData = gameApiCache.getCachedGame(gameName, "giantbomb");
    if (cachedData) {
      console.log(`Using cached GiantBomb data for: ${gameName}`);
      return cachedData;
    }

    console.log(`Fetching GiantBomb data for: ${gameName}`);

    // Extract config values
    const { apiKey, enabled = true } = config;

    // Skip if not enabled or missing credentials
    if (!enabled || !apiKey) {
      console.log("GiantBomb integration is not enabled or missing API key");
      return null;
    }

    // Search for the game
    const searchResult = await searchGameGiantBomb(gameName, apiKey);

    if (!searchResult) {
      return null;
    }

    // Get detailed game info
    const gameDetails = await getGameDetailByIdGiantBomb(searchResult.guid, apiKey);

    if (!gameDetails) {
      return searchResult; // Return basic search result if detailed info not available
    }

    // Process and return the game data
    const processedDetails = {
      id: gameDetails.id,
      guid: gameDetails.guid,
      name: gameDetails.name,
      deck: gameDetails.deck,
      description: gameDetails.description,
      image: gameDetails.image,
      images: gameDetails.images || [],
      videos: gameDetails.videos || [],
      similar_games: gameDetails.similar_games || [],
      genres: gameDetails.genres || [],
      platforms: gameDetails.platforms || [],
      developers: gameDetails.developers || [],
      publishers: gameDetails.publishers || [],
      release_date: gameDetails.original_release_date,
      site_detail_url: gameDetails.site_detail_url,
    };

    // Cache the processed game data
    gameApiCache.cacheGame(gameName, processedDetails, "giantbomb");

    return processedDetails;
  } catch (error) {
    console.error("Error getting game details from GiantBomb:", error);
    return null;
  }
};

/**
 * Get game details from all available APIs
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with API credentials
 * @returns {Promise<Object>} Combined game details from all APIs
 */
const getGameDetails = async (gameName, config = {}) => {
  // Default to using all enabled APIs
  const useIgdb = config.igdb?.enabled !== false;
  const useGiantBomb = config.giantbomb?.enabled !== false;

  // Results object
  const results = {};

  // Run API calls in parallel
  const promises = [];

  if (useIgdb) {
    promises.push(
      getGameDetailsIGDB(gameName, config.igdb)
        .then(data => {
          results.igdb = data;
        })
        .catch(error => {
          console.error("IGDB API error:", error);
          results.igdb = null;
        })
    );
  }

  if (useGiantBomb) {
    promises.push(
      getGameDetailsGiantBomb(gameName, config.giantbomb)
        .then(data => {
          results.giantbomb = data;
        })
        .catch(error => {
          console.error("GiantBomb API error:", error);
          results.giantbomb = null;
        })
    );
  }

  // Wait for all API calls to complete
  await Promise.all(promises);

  // For backward compatibility, if IGDB is the only API used, return its results directly
  if (useIgdb && !useGiantBomb) {
    return results.igdb;
  }

  return results;
};

// Export the service functions
export default {
  // Main function to get game details from all APIs
  getGameDetails,

  // Individual API functions
  getGameDetailsIGDB,
  getGameDetailsGiantBomb,

  // Helper functions
  formatImageUrl: formatIgdbImageUrl, // For backward compatibility
  formatIgdbImageUrl,
};
