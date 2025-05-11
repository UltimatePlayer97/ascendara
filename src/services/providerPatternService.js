const PROVIDER_API_URL = "https://api.ascendara.app/app/json/providers";

/**
 * Fetches provider regex patterns from the API.
 * @returns {Promise<Object>} A mapping of provider names to regex strings.
 */
export async function fetchProviderPatterns() {
  // Try to read from localStorage cache
  try {
    const cached = JSON.parse(localStorage.getItem("providerPatternsCache"));
    if (cached && cached.lastUpdated && cached.patterns) {
      // Check lastUpdated from server
      const response = await fetch(PROVIDER_API_URL, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Failed to fetch provider patterns: ${response.status}`);
      }
      const data = await response.json();
      if (data.lastUpdated === cached.lastUpdated) {
        // Use cached patterns (regex object only)
        return cached.patterns;
      } else {
        // Update cache with new patterns (store only regex object)
        localStorage.setItem(
          "providerPatternsCache",
          JSON.stringify({
            lastUpdated: data.lastUpdated,
            patterns: data.regex,
          })
        );
        return data.regex;
      }
    } else {
      // No cache, fetch and store
      const response = await fetch(PROVIDER_API_URL, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Failed to fetch provider patterns: ${response.status}`);
      }
      const data = await response.json();
      localStorage.setItem(
        "providerPatternsCache",
        JSON.stringify({
          lastUpdated: data.lastUpdated,
          patterns: data.regex,
        })
      );
      return data.regex;
    }
  } catch (e) {
    // On error, fallback to fetch
    const response = await fetch(PROVIDER_API_URL, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to fetch provider patterns: ${response.status}`);
    }
    const data = await response.json();
    localStorage.setItem(
      "providerPatternsCache",
      JSON.stringify({
        lastUpdated: data.lastUpdated,
        patterns: data.regex,
      })
    );
    return data.regex;
  }
}

/**
 * Get the regex pattern for a given provider.
 * @param {string} provider - Provider key (e.g., "buzzheavier")
 * @param {Object} patterns - Provider patterns object
 * @returns {RegExp|null}
 */
export function getProviderPattern(provider, patterns) {
  if (!patterns || !patterns[provider]) return null;
  try {
    return new RegExp(patterns[provider], "i");
  } catch (e) {
    console.error(`Invalid regex for provider ${provider}:`, e);
    return null;
  }
}
