/**
 * ImageCacheService - A simplified and robust image caching service
 */
import gameService from "./gameService";

class ImageCacheService {
  constructor() {
    // Core caching
    this.memoryCache = new Map(); // imgID -> { url, quality }
    this.memoryCacheOrder = [];
    this.maxMemoryCacheSize = 150;
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.initRetries = 0;
    this.maxInitRetries = 3;

    // Request management
    this.activeRequests = new Map();
    this.maxConcurrentRequests = 12;
    this.retryDelay = 2000;
    this.maxRetries = 2;

    // Preloading and prioritization
    this.preloadQueue = new Set();
    this.visibleImages = new Set();
    this.priorityQueue = [];
    this.lowPriorityQueue = [];
    this.processingQueue = false;

    // 404 error tracking
    this.recent404Count = 0;
    this.max404BeforeClear = 4;

    // Initialize
    this.initPromise = this.initializeDB();
  }

  async initializeDB() {
    if (this.initRetries >= this.maxInitRetries) {
      console.warn(
        "[ImageCache] Max init retries reached, continuing with memory-only cache"
      );
      this.isInitialized = true;
      return;
    }

    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.warn(
          "[ImageCache] IndexedDB not available, continuing with memory-only cache"
        );
        this.isInitialized = true;
        return;
      }

      const request = indexedDB.open("ImageCache", 1);

      return new Promise((resolve, reject) => {
        let hasErrored = false;

        request.onupgradeneeded = event => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("images")) {
              db.createObjectStore("images", { keyPath: "id" });
            }
          } catch (error) {
            console.error("[ImageCache] Error during database upgrade:", error);
            hasErrored = true;
          }
        };

        request.onsuccess = event => {
          if (hasErrored) {
            this.retryInitialization(resolve);
            return;
          }

          try {
            this.db = event.target.result;
            this.isInitialized = true;
            console.log(
              "[ImageCache] Ascendara Image Cache service initialized, IndexedDB ready"
            );
            resolve();
          } catch (error) {
            this.retryInitialization(resolve);
          }
        };

        request.onerror = () => {
          this.retryInitialization(resolve);
        };
      });
    } catch (error) {
      console.warn("[ImageCache] IndexedDB initialization failed:", error);
      this.retryInitialization();
    }
  }

  async retryInitialization(resolve) {
    this.initRetries++;
    console.warn(
      `[ImageCache] Retrying initialization (attempt ${this.initRetries}/${this.maxInitRetries})`
    );

    if (this.initRetries < this.maxInitRetries) {
      setTimeout(() => {
        this.initPromise = this.initializeDB();
        if (resolve) this.initPromise.then(resolve);
      }, 1000);
    } else {
      console.warn(
        "[ImageCache] Max init retries reached, continuing with memory-only cache"
      );
      this.isInitialized = true;
      if (resolve) resolve();
    }
  }

  /**
   * Get image URL for given imgID. Uses LRU memory cache, IndexedDB, and deduplication.
   * If the image is requested multiple times concurrently, all requests await the same promise.
   */
  async getImage(imgID, options = { priority: "normal", quality: "high" }) {
    if (!imgID) return null;

    // Wait for initialization
    await this.initPromise;

    // Check memory cache first (LRU)
    if (this.memoryCache.has(imgID)) {
      const cached = this.memoryCache.get(imgID);
      // Move to most recently used
      this.memoryCacheOrder = this.memoryCacheOrder.filter(id => id !== imgID);
      this.memoryCacheOrder.push(imgID);

      // If we have the requested quality or better, return it
      if (options.quality === "low" || cached.quality === options.quality) {
        console.debug(`[ImageCache] Memory cache HIT for ${imgID}`);
        return cached.url;
      }

      // If we need higher quality, let it fall through to load high quality version
      if (options.quality === "high" && cached.quality === "low") {
        console.debug(`[ImageCache] Upgrading quality for ${imgID}`);
      }
    }

    // Try IndexedDB cache if available
    if (this.db) {
      try {
        const cachedImage = await this.getFromIndexedDB(imgID);
        if (cachedImage) {
          const url = URL.createObjectURL(cachedImage);
          this._setMemoryCache(imgID, url);
          // Logging for IndexedDB hit
          console.debug(`[ImageCache] IndexedDB cache HIT for ${imgID}`);
          return url;
        }
      } catch (error) {
        console.warn(`[ImageCache] Failed to read from IndexedDB for ${imgID}:`, error);
      }
    }

    // If already being loaded, return the existing promise
    if (this.activeRequests.has(imgID)) {
      return this.activeRequests.get(imgID);
    }

    // Start loading
    // Logging for cache miss (network fetch)
    console.debug(`[ImageCache] Cache MISS for ${imgID}, fetching from network`);
    const loadPromise = this.loadImage(imgID);
    this.activeRequests.set(imgID, loadPromise);

    try {
      const result = await loadPromise;
      this._setMemoryCache(imgID, result);
      return result;
    } catch (error) {
      this.activeRequests.delete(imgID);
      throw error;
    } finally {
      this.activeRequests.delete(imgID);
    }
  }

  _setMemoryCache(imgID, url, quality = "high") {
    this.memoryCache.set(imgID, { url, quality });
    this.memoryCacheOrder = this.memoryCacheOrder.filter(id => id !== imgID);
    this.memoryCacheOrder.push(imgID);

    // Cleanup if cache is too large
    while (this.memoryCacheOrder.length > this.maxMemoryCacheSize) {
      const oldest = this.memoryCacheOrder.shift();
      if (oldest) {
        const oldCache = this.memoryCache.get(oldest);
        if (oldCache?.url) URL.revokeObjectURL(oldCache.url);
        this.memoryCache.delete(oldest);
      }
    }
  }

  async loadImage(
    imgID,
    retryCount = 0,
    options = { quality: "high", priority: "normal" }
  ) {
    if (!imgID) return null;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await this.generateSignature(timestamp);
      const settings = await window.electron.getSettings();
      const source = settings?.gameSource || "steamrip";

      let endpoint = "v2/image";
      if (source === "fitgirl") {
        endpoint = "v2/fitgirl/image";
      }

      // Add quality parameter for progressive loading
      if (options.quality === "low") {
        endpoint += "/preview";
      }

      const response = await fetch(`https://api.ascendara.app/${endpoint}/${imgID}`, {
        headers: {
          "X-Timestamp": timestamp.toString(),
          "X-Signature": signature,
          "Cache-Control": "no-store",
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          this.recent404Count++;
          console.warn(
            `[ImageCache] 404 for image ${imgID} (consecutive: ${this.recent404Count})`
          );
          if (this.recent404Count >= this.max404BeforeClear) {
            await this.clearCache();
            this.recent404Count = 0;
            console.warn(
              `[ImageCache] Cleared cache due to ${this.max404BeforeClear} consecutive 404s`
            );
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      // Cache the result with correct quality
      this._setMemoryCache(imgID, url, options.quality);
      // Save to IndexedDB in the background if available
      if (this.db) {
        this.saveToIndexedDB(imgID, blob).catch(error => {
          console.warn(`[ImageCache] Failed to save image ${imgID} to IndexedDB:`, error);
        });
      }
      // Reset 404 counter on success
      if (this.recent404Count > 0) this.recent404Count = 0;
      return url;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.loadImage(imgID, retryCount + 1);
      }
      throw error;
    }
  }

  async getFromIndexedDB(imgID) {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["images"], "readonly");
        const store = transaction.objectStore("images");
        const request = store.get(imgID);

        request.onsuccess = () => {
          const data = request.result;
          if (data && data.blob) {
            resolve(data.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateSignature(timestamp) {
    try {
      // Try to get secret from electron
      const secret = (await window.electron?.imageSecret()) || "default_secret";

      const encoder = new TextEncoder();
      const data = encoder.encode(timestamp.toString());
      const keyData = encoder.encode(secret);

      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signature = await crypto.subtle.sign("HMAC", key, data);
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("[ImageCache] Error generating signature:", error);
      throw error;
    }
  }

  async saveToIndexedDB(imgID, blob) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");
        const request = store.put({ id: imgID, blob, timestamp: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Utility methods
  clearCache() {
    console.log("[ImageCache] Clearing cache");
    this.memoryCache.clear();
    this.memoryCacheOrder = [];
    this.clearIndexedDB();

    // Clear localStorage cache
    try {
      localStorage.removeItem("ascendara_games_cache");
      localStorage.removeItem("local_ascendara_games_timestamp");
      localStorage.removeItem("local_ascendara_metadata_cache");

      // Force a refresh of the game data by fetching from API
      gameService
        .fetchDataFromAPI()
        .then(data => {
          gameService.updateCache(data);
          console.log("[ImageCache] Game service cache refreshed successfully");
        })
        .catch(error => {
          console.error("[ImageCache] Error refreshing game service cache:", error);
        });
    } catch (error) {
      console.error("[ImageCache] Error clearing game service cache:", error);
    }
  }

  clearIndexedDB() {
    if (this.db) {
      try {
        const transaction = this.db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");
        store.clear();
        console.log("[ImageCache] IndexedDB cleared successfully");
      } catch (error) {
        console.error("[ImageCache] Error clearing IndexedDB:", error);
      }
    }
  }

  invalidateCache(imgID) {
    if (!imgID) return;

    console.log(`[ImageCache] Invalidating cache for image ID: ${imgID}`);

    // Remove from memory cache
    if (this.memoryCache.has(imgID)) {
      this.memoryCache.delete(imgID);
      this.memoryCacheOrder = this.memoryCacheOrder.filter(id => id !== imgID);
    }

    // Remove from IndexedDB if available
    if (this.db) {
      try {
        const transaction = this.db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");
        store.delete(imgID);
      } catch (error) {
        console.error(
          `[ImageCache] Error removing image ${imgID} from IndexedDB:`,
          error
        );
      }
    }

    // Also clear from localStorage if it might be there
    try {
      // Since we don't know which game this imgID belongs to, we can't target specific keys
      // This is a best-effort approach to find and clear relevant localStorage items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith("game-cover-") || key.startsWith("game-image-")) {
          const value = localStorage.getItem(key);
          // If the value contains the imgID, remove it
          if (value && value.includes(imgID)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn("[ImageCache] Error clearing localStorage:", e);
    }
  }
}

export default new ImageCacheService();
