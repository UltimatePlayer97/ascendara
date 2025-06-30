import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettingsState] = useState({
    downloadDirectory: "",
    additionalDirectories: [],
    watchingFolders: [],
    showOldDownloadLinks: false,
    defaultOpenPage: "home",
    seeInappropriateContent: false,
    earlyReleasePreview: false,
    viewWorkshopPage: false,
    notifications: true,
    downloadHandler: false,
    torrentEnabled: false,
    gameSource: "steamrip",
    autoCreateShortcuts: true,
    smoothTransitions: true,
    sendAnalytics: true,
    autoUpdate: true,
    endOnClose: false,
    language: "en",
    theme: "purple",
    threadCount: 12,
    downloadLimit: 0,
    excludeFolders: false,
    sideScrollBar: false,
    prioritizeTorboxOverSeamless: false,
    crackDirectory: "",
    twitchSecret: "",
    twitchClientId: "",
    giantBombKey: "",
    torboxApiKey: "",
    ludusavi: {
      backupLocation: "",
      backupFormat: "zip",
      enabled: false,
      backupOptions: {
        backupsToKeep: 5,
        skipManifestCheck: false,
        compressionLevel: "default",
      },
    },
  });

  const setSettings = useCallback(
    async newSettings => {
      // If newSettings is a function, call it with current settings
      const updatedSettings =
        typeof newSettings === "function"
          ? newSettings(settings)
          : { ...settings, ...newSettings };

      // Update local state
      setSettingsState(updatedSettings);

      // Save to electron
      try {
        await window.electron.saveSettings(updatedSettings);
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    },
    [settings]
  );

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electron.getSettings();
        if (savedSettings) {
          setSettingsState(savedSettings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();

    // Listen for settings changes from other parts of the app
    const handleSettingsChange = (event, newSettings) => {
      setSettingsState(prevSettings => ({
        ...prevSettings,
        ...newSettings,
      }));
    };

    window.electron.ipcRenderer.on("settings-updated", handleSettingsChange);

    return () => {
      window.electron.ipcRenderer.off("settings-updated", handleSettingsChange);
    };
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
