/**
 * IGDB Cache Service
 * Handles caching of IGDB game data to reduce API calls
 */

// Constants
const CACHE_PREFIX = "igdb_cache_";
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get cached game data
 * @param {string} gameName - Name of the game
 * @returns {Object|null} Cached game data or null if not found/expired
 */
const getCachedGame = gameName => {
  try {
    // Normalize game name for consistent cache keys
    const cacheKey = `${CACHE_PREFIX}${normalizeGameName(gameName)}`;

    // Get from localStorage
    const cachedData = localStorage.getItem(cacheKey);

    if (!cachedData) {
      return null;
    }

    const { data, timestamp } = JSON.parse(cachedData);

    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error retrieving cached game data:", error);
    return null;
  }
};

/**
 * Cache game data
 * @param {string} gameName - Name of the game
 * @param {Object} gameData - Game data to cache
 */
const cacheGame = (gameName, gameData) => {
  try {
    if (!gameData) return;

    // Normalize game name for consistent cache keys
    const cacheKey = `${CACHE_PREFIX}${normalizeGameName(gameName)}`;

    // Create cache object with timestamp
    const cacheObject = {
      data: gameData,
      timestamp: Date.now(),
    };

    // Store in localStorage
    localStorage.setItem(cacheKey, JSON.stringify(cacheObject));
  } catch (error) {
    console.error("Error caching game data:", error);
  }
};

/**
 * Clear expired cache entries
 */
const clearExpiredCache = () => {
  try {
    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      // Only process IGDB cache entries
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cachedData = localStorage.getItem(key);
          const { timestamp } = JSON.parse(cachedData);

          // Remove if expired
          if (Date.now() - timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // If entry is corrupted, remove it
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error("Error clearing expired cache:", error);
  }
};

/**
 * Clear all IGDB cache entries
 */
const clearAllCache = () => {
  try {
    // Get all localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    // Remove all IGDB cache keys
    keysToRemove.forEach(key => localStorage.removeItem(key));

    return keysToRemove.length;
  } catch (error) {
    console.error("Error clearing cache:", error);
    return 0;
  }
};

/**
 * Normalize game name for consistent cache keys
 * @param {string} gameName - Name of the game
 * @returns {string} Normalized game name
 */
const normalizeGameName = gameName => {
  return gameName
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, "_"); // Replace spaces with underscores
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
const getCacheStats = () => {
  try {
    let count = 0;
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(CACHE_PREFIX)) {
        count++;
        totalSize += localStorage.getItem(key).length;
      }
    }

    return {
      count,
      totalSize: Math.round(totalSize / 1024), // Size in KB
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return { count: 0, totalSize: 0 };
  }
};

// Run cleanup on service initialization
clearExpiredCache();

// Export the service functions
export default {
  getCachedGame,
  cacheGame,
  clearExpiredCache,
  clearAllCache,
  getCacheStats,
};
