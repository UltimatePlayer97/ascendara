/**
 * Game Data Service
 * Handles fetching game data from multiple APIs:
 * - IGDB (via Twitch): https://api-docs.igdb.com/#authentication
 * - GiantBomb: https://www.giantbomb.com/api/
 */

// Import cache service
import gameApiCache from "./gameInfoCacheService";

// Constants for APIs
const isDev = import.meta.env.DEV;

// IGDB API endpoints
const IGDB_API_URL = isDev ? "/api/igdb" : "https://api.igdb.com/v4";
const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";

// GiantBomb API endpoints
const GIANTBOMB_API_URL = isDev ? "/api/giantbomb" : "https://www.giantbomb.com/api";

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

    // Set up headers
    const headers = {
      Accept: "application/json",
      "User-Agent": "Ascendara Game Library (contact@ascendara.com)",
    };

    // In production, we need to add CORS headers
    if (!isDev) {
      headers["Access-Control-Allow-Origin"] = "*";
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`GiantBomb API error: ${response.status}`);
    }

    const data = await response.json();

    console.log("GiantBomb search response:", data);

    if (data.error === "OK" && data.results && data.results.length > 0) {
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
    console.log(`Fetching GiantBomb details for game ID: ${gameId}`);

    // Construct the URL with the game ID and API key
    // Include fields parameter to request specific data including images
    const url = `https://www.giantbomb.com/api/game/${gameId}/?api_key=${apiKey}&format=json&field_list=id,name,deck,description,image,images,genres,platforms,videos,original_release_date,site_detail_url,aliases`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`GiantBomb API error: ${response.status}`);
    }

    const data = await response.json();

    console.log("GiantBomb detail response:", data);

    if (data.error === "OK" && data.results) {
      return data.results;
    }

    return null;
  } catch (error) {
    console.error("Error getting game details from GiantBomb:", error);
    return null;
  }
};

/**
 * Get game details from GiantBomb
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with apiKey
 * @returns {Promise<Object>} Game details
 */
const getGameDetailsGiantBomb = async (gameName, config) => {
  try {
    console.log(`Fetching GiantBomb data for: ${gameName}`);

    // Extract config values
    const apiKey = config.apiKey;

    // Skip if missing credentials
    if (!apiKey) {
      console.log("GiantBomb integration is missing API key");
      return null;
    }

    // Search for the game
    const searchResult = await searchGameGiantBomb(gameName, apiKey);

    console.log("GiantBomb search result:", searchResult);

    if (!searchResult) {
      console.log(`No GiantBomb results found for: ${gameName}`);
      return null;
    }

    // Get detailed game info
    const gameDetails = await getGameDetailByIdGiantBomb(searchResult.guid, apiKey);

    if (!gameDetails) {
      console.log(
        `No detailed GiantBomb data found for: ${gameName} (${searchResult.guid})`
      );
      // Format basic search result to match IGDB format
      return formatGiantBombToIgdbFormat(searchResult);
    }

    // Process and format the game data to match IGDB format
    const formattedDetails = formatGiantBombToIgdbFormat(gameDetails);

    console.log(`Successfully processed GiantBomb data for: ${gameName}`);

    // Cache the processed game data
    gameApiCache.cacheGame(gameName, formattedDetails, "giantbomb");

    return formattedDetails;
  } catch (error) {
    console.error("Error getting game details from GiantBomb:", error);
    return null;
  }
};

/**
 * Format GiantBomb data to match IGDB format for compatibility
 * @param {Object} giantBombData - Raw GiantBomb data
 * @returns {Object} Formatted data in IGDB-compatible format
 */
const formatGiantBombToIgdbFormat = giantBombData => {
  if (!giantBombData) return null;

  // Extract image URLs
  const screenshots = [];

  // Add main image if available
  if (giantBombData.image) {
    screenshots.push({
      id: `gb-main-${giantBombData.id}`,
      url: giantBombData.image.original_url,
      image_id: `gb-main-${giantBombData.id}`,
      width: giantBombData.image.width || 1920,
      height: giantBombData.image.height || 1080,
      formatted_url: giantBombData.image.original_url,
    });
  }

  // Add additional images if available
  if (giantBombData.images && Array.isArray(giantBombData.images)) {
    giantBombData.images.forEach((image, index) => {
      // Only add screenshots (type: "screenshot")
      if (image.tags && image.tags.includes("Screenshot")) {
        screenshots.push({
          id: `gb-${image.id || index}`,
          image_id: `gb-${image.id || index}`,
          url: image.original_url,
          width: image.width || 1920,
          height: image.height || 1080,
          formatted_url: image.original_url,
        });
      }
    });
  }

  // Extract platforms
  const platforms = [];
  if (giantBombData.platforms && Array.isArray(giantBombData.platforms)) {
    giantBombData.platforms.forEach(platform => {
      platforms.push({
        id: platform.id,
        name: platform.name,
        abbreviation: platform.abbreviation || "",
      });
    });
  }

  // Extract genres
  const genres = [];
  if (giantBombData.genres && Array.isArray(giantBombData.genres)) {
    giantBombData.genres.forEach(genre => {
      genres.push({
        id: genre.id,
        name: genre.name,
      });
    });
  }

  // Format the data to match IGDB structure
  return {
    id: giantBombData.id,
    name: giantBombData.name,
    summary: giantBombData.deck || "",
    description: giantBombData.description || "",
    storyline: giantBombData.description || "",

    // IGDB specific fields with GiantBomb data
    cover: giantBombData.image
      ? {
          id: giantBombData.id,
          image_id: giantBombData.id,
          url: giantBombData.image.original_url,
          width: giantBombData.image.width || 1920,
          height: giantBombData.image.height || 1080,
          formatted_url: giantBombData.image.original_url,
        }
      : null,

    screenshots: screenshots,
    formatted_screenshots: screenshots,
    videos: giantBombData.videos || [],
    similar_games: [],
    genres: genres,
    platforms: platforms,

    // Additional GiantBomb specific fields
    aliases: giantBombData.aliases || "",
    release_date: giantBombData.original_release_date,
    site_detail_url: giantBombData.site_detail_url,

    // Source information
    source: "giantbomb",
  };
};

/**
 * Get game details from IGDB
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with clientId and clientSecret
 * @returns {Promise<Object>} Game details
 */
const getGameDetailsIGDB = async (gameName, config = {}) => {
  try {
    console.log(`Fetching IGDB data for: ${gameName}`);

    // Extract config values
    const clientId = config.clientId;
    const clientSecret = config.clientSecret;

    // Skip if missing credentials
    if (!clientId || !clientSecret) {
      console.log("IGDB integration is missing credentials");
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
 * Get game details from all available APIs
 * @param {string} gameName - Name of the game
 * @param {Object} config - Configuration with API credentials
 * @returns {Promise<Object>} Combined game details from all APIs
 */
const getGameDetails = async (gameName, config = {}) => {
  console.log("getGameDetails config:", config);

  // Extract credentials from config
  const clientId = config.clientId || "";
  const clientSecret = config.clientSecret || "";

  // Extract GiantBomb API key - check both formats for backward compatibility
  let giantBombApiKey = "";
  if (config.giantbomb && config.giantbomb.apiKey) {
    giantBombApiKey = config.giantbomb.apiKey;
  } else if (config.giantBombKey) {
    giantBombApiKey = config.giantBombKey;
  }

  console.log(
    "IGDB credentials:",
    clientId ? "Set" : "Not set",
    clientSecret ? "Set" : "Not set"
  );
  console.log("GiantBomb API key:", giantBombApiKey ? "Set" : "Not set");

  // Check if IGDB is enabled (has valid credentials)
  const useIgdb =
    clientId && clientSecret && clientId.trim() !== "" && clientSecret.trim() !== "";

  // Check if GiantBomb is enabled (has valid API key)
  const useGiantBomb = giantBombApiKey && giantBombApiKey.trim() !== "";

  console.log("Using IGDB:", useIgdb);
  console.log("Using GiantBomb:", useGiantBomb);

  // If no API is enabled, return null
  if (!useIgdb && !useGiantBomb) {
    console.log("No game API integration is enabled");
    return null;
  }

  // Check cache first
  let cachedData = gameApiCache.getCachedGame(gameName, "combined");
  if (cachedData) {
    console.log(`Using cached combined data for: ${gameName}`);
    return cachedData;
  }

  // Results object
  let gameData = null;

  // Try IGDB first if enabled
  if (useIgdb) {
    gameData = await getGameDetailsIGDB(gameName, {
      clientId,
      clientSecret,
      enabled: true,
    });

    if (gameData) {
      gameData.source = "igdb";

      // Format screenshots for IGDB data
      if (gameData.screenshots && gameData.screenshots.length > 0) {
        gameData.formatted_screenshots = gameData.screenshots.map(screenshot => ({
          ...screenshot,
          formatted_url: formatImageUrl(screenshot.url, "screenshot_huge"),
        }));
      }
    }
  }

  // If no IGDB data or IGDB not enabled, try GiantBomb
  if (!gameData && useGiantBomb) {
    gameData = await getGameDetailsGiantBomb(gameName, {
      apiKey: giantBombApiKey,
      enabled: true,
    });

    // GiantBomb data is already formatted to match IGDB format in the formatGiantBombToIgdbFormat function
  }

  // Cache the data if we found any
  if (gameData) {
    gameApiCache.cacheGame(gameName, gameData, "combined");
  } else {
    console.log(`No game data found for: ${gameName}`);
  }

  return gameData;
};

/**
 * Format image URL to get the appropriate size
 * @param {string} url - Original image URL from IGDB or GiantBomb
 * @param {string} size - Size of the image (e.g., 'cover_big', 'screenshot_huge')
 * @returns {string} Formatted image URL
 */
const formatImageUrl = (url, size = "screenshot_big") => {
  if (!url) return null;

  // Check if it's a GiantBomb URL
  if (url.includes("giantbomb.com")) {
    // GiantBomb URLs don't need size formatting, just return the original
    return url;
  }

  // Handle IGDB URL
  // Replace the size in the URL
  // Original URL format: //images.igdb.com/igdb/image/upload/t_thumb/co1wyy.jpg
  return url.replace("t_thumb", `t_${size}`).replace("//", "https://");
};

// Export the service functions
export default {
  // Main function to get game details from all APIs
  getGameDetails,

  // Individual API functions
  getGameDetailsIGDB,
  getGameDetailsGiantBomb,

  // Helper functions
  formatImageUrl,
};
