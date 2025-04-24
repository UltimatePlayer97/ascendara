import { useState, useEffect } from "react";
import imageCacheService from "@/services/imageCacheService";

// Track which images are currently being loaded to prevent duplicate requests
const loadingImages = new Map();

// Shared image loading hook to prevent duplicate loading
export function useImageLoader(
  imgID,
  options = { quality: "high", priority: "normal", enabled: true }
) {
  const [state, setState] = useState({
    cachedImage: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      if (!imgID || !options.enabled) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: null,
          });
        }
        return;
      }

      // Check if this image is already being loaded with the same quality
      const loadingKey = `${imgID}-${options.quality}`;
      if (loadingImages.has(loadingKey)) {
        const existingPromise = loadingImages.get(loadingKey);
        try {
          const cached = await existingPromise;
          if (mounted) {
            setState({
              cachedImage: cached,
              loading: false,
              error: cached ? null : "Failed to load image",
            });
          }
        } catch (error) {
          if (mounted) {
            setState({
              cachedImage: null,
              loading: false,
              error: error.message || "Failed to load image",
            });
          }
        }
        return;
      }

      try {
        setState({ cachedImage: null, loading: true, error: null });

        // Create a new loading promise with quality and priority options
        const loadPromise = imageCacheService.getImage(imgID, options);
        loadingImages.set(loadingKey, loadPromise);

        try {
          const cached = await loadPromise;
          if (mounted) {
            setState({
              cachedImage: cached,
              loading: false,
              error: null,
            });
          }
        } catch (error) {
          if (mounted) {
            setState({
              cachedImage: null,
              loading: false,
              error: error.message || "Failed to load image",
            });
          }
        } finally {
          loadingImages.delete(loadingKey);
        }
      } catch (error) {
        if (mounted) {
          setState({
            cachedImage: null,
            loading: false,
            error: error.message || "Failed to load image",
          });
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [imgID, options.enabled, options.quality, options.priority]);

  return state;
}
