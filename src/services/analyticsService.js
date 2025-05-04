/**
 * Analytics and reporting are only available in official builds to ensure security.
 *
 * @see https://ascendara.app/docs/developer/build-from-source#important-limitations
 */
export const analytics = {
  isDummy: true,
  trackPageView: page => {
    console.debug("[Analytics] Page view:", page);
  },
  trackEvent: (event, properties) => {
    console.debug("[Analytics] Event:", event, properties);
  },
  trackError: (error, info) => {
    console.debug("[Analytics] Error:", error, info);
  },
  flushEvents: () => {
    console.debug("[Analytics] Flushing events");
  },
  trackGameButtonClick: (gameName, buttonType, extra = {}) => {
    console.debug("[Analytics] Game button click:", { gameName, buttonType, ...extra });
  },
  trackFeatureUsage: (featureName, details = {}) => {
    console.debug("[Analytics] Feature usage:", { featureName, ...details });
  },
  trackTourProgress: (stepNumber, stepName, completed = false) => {
    console.debug("[Analytics] Tour progress:", { stepNumber, stepName, completed });
  },
  updateSettings: async () => {
    console.debug("[Analytics] Settings updated");
  },
  initSession: async () => {
    console.debug("[Analytics] Session initialized");
    return "dummy-session-id";
  },
  getLiveStats: async () => {
    console.debug("[Analytics] Get live stats");
    return { unique_users: 0, live_instances: 0, error: false };
  }
};

if (typeof window !== "undefined" && window.electron) {
  window.electron.onSettingsChanged(async () => {
    await analytics.updateSettings();
  });
}
