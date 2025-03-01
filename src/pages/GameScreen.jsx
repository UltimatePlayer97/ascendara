import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Heart,
  Play,
  FolderOpen,
  Gamepad2,
  Gift,
  Tag,
  PackageOpen,
  Trash2,
  Pencil,
  Monitor,
  StopCircle,
  Loader,
  FileCheck2,
  FolderSync,
  AlertTriangle,
  Info,
  Star,
  Clock,
  ExternalLink,
  Settings2,
  Download,
  PlayCircleIcon,
  FileSearch,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSettings } from "@/context/SettingsContext";
import { useIgdbConfig } from "@/services/igdbConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import VerifyingGameDialog from "@/components/VerifyingGameDialog";
import recentGamesService from "@/services/recentGamesService";
import GamesBackupDialog from "@/components/GamesBackupDialog";
import GameScreenshots from "@/components/GameScreenshots";
import GameMetadata from "@/components/GameMetadata";
import imageCacheService from "@/services/imageCacheService";
import igdbService from "@/services/igdbService";

const ErrorDialog = ({ open, onClose, errorGame, errorMessage, t }) => (
  <AlertDialog open={open} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-2xl font-bold text-foreground">
          {t("library.launchError")}
        </AlertDialogTitle>
        <AlertDialogDescription className="space-y-4 text-muted-foreground">
          {t("library.launchErrorMessage", { game: errorGame })}&nbsp;
          <span
            onClick={() => {
              window.electron.openURL(
                "https://ascendara.app/docs/troubleshooting/common-issues#executable-not-found-launch-error"
              );
            }}
            className="cursor-pointer hover:underline"
          >
            {t("common.learnMore")} <ExternalLink className="mb-1 inline-block h-3 w-3" />
          </span>
          <br />
          <br />
          {errorMessage}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex gap-2">
        <Button variant="outline" className="text-primary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          className="bg-primary text-secondary"
          onClick={async () => {
            const exePath = await window.electron.openFileDialog();
            if (exePath) {
              await window.electron.modifyGameExecutable(errorGame, exePath);
            }
            onClose();
          }}
        >
          {t("library.changeExecutable")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const UninstallConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  gameName,
  isUninstalling,
  t,
}) => (
  <AlertDialog open={open} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-2xl font-bold text-foreground">
          {t("library.confirmDelete")}
        </AlertDialogTitle>
        <AlertDialogDescription className="space-y-4 text-muted-foreground">
          {t("library.deleteConfirmMessage", { game: gameName })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex gap-2">
        <Button variant="outline" className="text-primary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button className="text-secondary" onClick={onConfirm} disabled={isUninstalling}>
          {isUninstalling ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              {t("library.deleting")}
            </>
          ) : (
            t("library.delete", { game: gameName })
          )}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default function GameScreen() {
  const showError = (game, error) => {
    setErrorGame(game);
    setErrorMessage(error);
    setShowErrorDialog(true);
  };

  const handleGameLaunchError = (_, { game, error }) => {
    showError(game, error);
  };

  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { gameData } = location.state || {};
  const { settings } = useSettings();
  const igdbConfig = useIgdbConfig();
  const [game, setGame] = useState(gameData || null);
  const [loading, setLoading] = useState(!gameData);
  const [imageData, setImageData] = useState("");
  const [executableExists, setExecutableExists] = useState(true);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem("game-favorites");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [isVerifyingOpen, setIsVerifyingOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [showVrWarning, setShowVrWarning] = useState(false);
  const [showOnlineFixWarning, setShowOnlineFixWarning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [ratingGame, setRatingGame] = useState(null);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorGame, setErrorGame] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [igdbData, setIgdbData] = useState(null);
  const [igdbLoading, setIgdbLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const init = async () => {
      setIsInitialized(true);
    };
    init();
  }, []);

  // Load game data
  useEffect(() => {
    const loadGame = async () => {
      try {
        // If we don't have game data from location state, navigate back to library
        if (!game) {
          navigate("/library");
          return;
        }

        setLoading(true);

        // Check if executable exists
        if (game.executable) {
          const exists = await window.electron.checkFileExists(game.executable);
          setExecutableExists(exists);
        }

        // Check if game is running
        const running = await window.electron.isGameRunning(game.game || game.name);
        setIsRunning(running);

        setLoading(false);

        // Fetch IGDB data
        fetchIgdbData(game.game || game.name);
      } catch (error) {
        console.error("Error loading game:", error);
        setLoading(false);
      }
    };

    loadGame();

    // Set up game running status listener
    const gameStatusInterval = setInterval(async () => {
      if (game) {
        const running = await window.electron.isGameRunning(game.game || game.name);
        setIsRunning(running);
      }
    }, 5000);

    return () => {
      clearInterval(gameStatusInterval);
    };
  }, [game, navigate]);

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return; // Don't set up listeners until initialized

    const handleGameClosed = async () => {
      if (gameData) {
        // Get fresh game data
        const freshGames = await window.electron.getGames();
        const gameData = freshGames.find(
          g => (g.game || g.name) === (game.game || game.name)
        );

        if (gameData && gameData.launchCount === 1) {
          setRatingGame(gameData.game || gameData.name);
          setShowRateDialog(true);
        }
      }
    };

    window.electron.ipcRenderer.on("game-launch-error", handleGameLaunchError);
    window.electron.ipcRenderer.on("game-closed", handleGameClosed);

    return () => {
      window.electron.ipcRenderer.removeListener(
        "game-launch-error",
        handleGameLaunchError
      );
      window.electron.ipcRenderer.removeListener("game-closed", handleGameClosed);
    };
  }, [isInitialized, setRatingGame, setShowRateDialog]); // Add required dependencies

  // Update favorite status when game or favorites change
  useEffect(() => {
    if (game && favorites) {
      const gameName = game.game || game.name;
      setIsFavorite(favorites.includes(gameName));
    }
  }, [game, favorites]);

  // Save favorites when they change
  useEffect(() => {
    localStorage.setItem("game-favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Load game image
  useEffect(() => {
    let isMounted = true;
    const gameId = game.game || game.name;

    const loadGameImage = async () => {
      try {
        // First try to use IGDB cover if available
        if (igdbData?.cover?.url) {
          const coverUrl = igdbService.formatImageUrl(igdbData.cover.url, "cover_big");
          if (coverUrl && isMounted) {
            setImageData(coverUrl);
            return;
          }
        }

        // Fall back to local game image if IGDB cover is not available
        const imageBase64 = await window.electron.getGameImage(gameId);
        if (imageBase64 && isMounted) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error("Error loading game image:", error);
      }
    };

    loadGameImage();

    return () => {
      isMounted = false;
    };
  }, [game.game, game.name, igdbData?.cover?.url]); // Add igdbData.cover.url as dependency

  // Toggle favorite status
  const toggleFavorite = async () => {
    try {
      const gameName = game.game || game.name;

      if (isFavorite) {
        // Remove from favorites
        setFavorites(favorites.filter(fav => fav !== gameName));
      } else {
        // Add to favorites
        setFavorites([...favorites, gameName]);
      }

      // Update isFavorite state (this will be handled by the useEffect)
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  // Format playtime
  const formatPlaytime = playTime => {
    if (playTime === undefined) return t("library.neverPlayed");

    if (playTime < 60) return t("library.lessThanMinute");
    if (playTime < 120) return `1 ${t("library.minute")} ${t("library.ofPlaytime")}`;
    if (playTime < 3600)
      return `${Math.floor(playTime / 60)} ${t("library.minutes")} ${t("library.ofPlaytime")}`;
    if (playTime < 7200) return `1 ${t("library.hour")} ${t("library.ofPlaytime")}`;
    return `${Math.floor(playTime / 3600)} ${t("library.hours")} ${t("library.ofPlaytime")}`;
  };

  // Handle play game
  const handlePlayGame = async (forcePlay = false) => {
    const gameName = game.game || game.name;
    setIsLaunching(true);

    // Check if window.electron.isDev is true. Cannot run in developer mode
    if (await window.electron.isDev()) {
      toast.error(t("library.cannotRunDev"));
      setIsLaunching(false);
      return;
    }

    try {
      // First check if game is already running
      const isRunning = await window.electron.isGameRunning(gameName);
      if (isRunning) {
        toast.error(t("library.alreadyRunning", { game: gameName }));
        setIsLaunching(false);
        return;
      }

      // Check if game is VR and show warning
      if (game.isVr && !forcePlay) {
        setShowVrWarning(true);
        setIsLaunching(false);
        return;
      }

      if (game.online && (game.launchCount < 1 || !game.launchCount)) {
        // Check if warning has been shown before
        const onlineFixWarningShown = localStorage.getItem("onlineFixWarningShown");
        if (!onlineFixWarningShown) {
          setShowOnlineFixWarning(true);
          // Save that warning has been shown
          localStorage.setItem("onlineFixWarningShown", "true");
          setIsLaunching(false);
          return;
        }
      }

      console.log("Launching game: ", gameName);
      // Launch the game
      await window.electron.playGame(gameName, game.isCustom, game.backups ?? false);

      // Get and cache the game image before saving to recently played
      const imageBase64 = await window.electron.getGameImage(gameName);
      if (imageBase64) {
        await imageCacheService.getImage(game.imgID);
      }

      // Save to recently played games
      recentGamesService.addRecentGame({
        game: gameName,
        name: game.name,
        imgID: game.imgID,
        version: game.version,
        isCustom: game.isCustom,
        online: game.online,
        dlc: game.dlc,
      });

      setIsLaunching(false);
    } catch (error) {
      console.error("Error launching game:", error);
      setIsLaunching(false);
    }
  };

  // Handle open directory
  const handleOpenDirectory = async () => {
    if (!game) return;
    await window.electron.openGameDirectory(game.game || game.name);
  };

  // Handle delete game
  const handleDeleteGame = async () => {
    try {
      if (game.isCustom) {
        await window.electron.removeCustomGame(game.game || game.name);
      } else {
        await window.electron.deleteGame(game.game || game.name);
      }
      navigate("/library");
      return;
    } catch (error) {
      console.error("Error deleting game:", error);
      setIsUninstalling(false);
    }
  };

  // Handle close error dialog
  const handleCloseErrorDialog = () => {
    setShowErrorDialog(false);
    setErrorGame("");
    setErrorMessage("");
  };

  // Fetch IGDB data
  const fetchIgdbData = async gameName => {
    try {
      if (!igdbConfig.enabled) {
        console.log("IGDB integration is not enabled");
        return;
      }

      setIgdbLoading(true);

      const data = await igdbService.getGameDetails(gameName, igdbConfig);

      if (data) {
        if (data.screenshots && data.screenshots.length > 0) {
          data.formatted_screenshots = data.screenshots.map(screenshot => ({
            ...screenshot,
            formatted_url: igdbService.formatImageUrl(screenshot.url, "screenshot_huge"),
          }));
        }
        setIgdbData(data);
      } else {
        console.log("No IGDB data found for:", gameName);
      }

      setIgdbLoading(false);
    } catch (error) {
      console.error("Error fetching IGDB data:", error);
      setIgdbLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  // Game not found
  if (!game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold">{t("gameScreen.gameNotFound")}</h1>
          <Button onClick={() => navigate("/library")}>
            {t("gameScreen.backToLibrary")}
          </Button>
        </div>
      </div>
    );
  }

  // Prepare screenshots data from IGDB if available
  const screenshots = igdbData?.formatted_screenshots || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero section with game banner/header */}
      <div className="relative w-full">
        <div className="container relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-between p-4 md:p-8">
          {/* Back button */}
          <Button
            variant="ghost"
            className="flex w-fit items-center gap-2 text-primary hover:bg-primary/10"
            onClick={() => navigate("/library")}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>

          {/* Game title and basic info */}
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-primary drop-shadow-md">
                {game.game}
              </h1>
              {game.online && (
                <Gamepad2
                  className="h-5 w-5 text-primary"
                  title={t("library.iconLegend.onlineFix")}
                />
              )}
              {game.dlc && (
                <Gift
                  className="h-5 w-5 text-primary"
                  title={t("library.iconLegend.allDlcs")}
                />
              )}
              {game.isVr && (
                <svg
                  className="p-0.5 text-primary"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  title={t("library.iconLegend.vrGame")}
                >
                  <path
                    d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V17C22 18.1046 21.1046 19 20 19H16.1324C15.4299 19 14.7788 18.6314 14.4174 18.029L12.8575 15.4292C12.4691 14.7818 11.5309 14.7818 11.1425 15.4292L9.58261 18.029C9.22116 18.6314 8.57014 19 7.86762 19H4C2.89543 19 2 18.1046 2 17V10Z"
                    stroke="currentColor"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.81253 6.7812C4.5544 5.6684 5.80332 5 7.14074 5H16.8593C18.1967 5 19.4456 5.6684 20.1875 6.7812L21 8H3L3.81253 6.7812Z"
                    stroke="currentColor"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {executableExists ? (
                <Button
                  variant="icon"
                  size="sm"
                  className="mb-2 text-primary transition-all hover:scale-110"
                  onClick={() => handlePlayGame()}
                  disabled={isLaunching || isRunning}
                >
                  {isLaunching ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                    </>
                  ) : isRunning ? (
                    <>
                      <StopCircle className="h-5 w-5" />
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 fill-current" />
                    </>
                  )}
                </Button>
              ) : (
                <AlertTriangle
                  className="mb-2 h-6 w-6 text-yellow-500"
                  title={t("library.executableNotFound")}
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-4">
              {game.version && (
                <div className="flex items-center gap-1 text-sm text-primary/80">
                  <Tag className="h-4 w-4" />
                  <span>{game.version}</span>
                </div>
              )}
              {game.size && (
                <div className="flex items-center gap-1 text-sm text-primary/80">
                  <PackageOpen className="h-4 w-4" />
                  <span>{game.size}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-primary/80">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{formatPlaytime(game.playTime)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left column - Game actions */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden">
              <CardContent className="space-y-6 p-6">
                {/* Main image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
                  <img
                    src={imageData}
                    alt={game.game}
                    className="h-full w-full object-cover"
                  />
                  {isUninstalling && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="w-full max-w-[200px] space-y-2 px-4">
                        <div className="relative overflow-hidden">
                          <Progress value={undefined} className="bg-muted/30" />
                          <div
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                            style={{
                              animation: "shimmer 3s infinite ease-in-out",
                              backgroundSize: "200% 100%",
                              WebkitAnimation: "shimmer 3s infinite ease-in-out",
                              WebkitBackgroundSize: "200% 100%",
                            }}
                          />
                        </div>
                        <div className="text-center text-sm font-medium text-primary">
                          <span className="flex items-center justify-center gap-2">
                            <Loader className="h-4 w-4 animate-spin" />
                            {t("library.deletingGame")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Favorite button */}
                <Button
                  variant="outline"
                  className="w-full gap-2 text-muted-foreground hover:text-primary"
                  onClick={toggleFavorite}
                >
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      isFavorite ? "fill-primary text-primary" : "fill-none"
                    )}
                  />
                  {isFavorite
                    ? t("library.removeFromFavorites")
                    : t("library.addToFavorites")}
                </Button>

                {/* Main actions */}
                <div className="space-y-3">
                  {executableExists ? (
                    <Button
                      className="w-full gap-2 py-6 text-lg text-secondary"
                      size="lg"
                      onClick={handlePlayGame}
                      disabled={isLaunching || isRunning}
                    >
                      {isLaunching ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          {t("library.launching")}
                        </>
                      ) : isRunning ? (
                        <>
                          <StopCircle className="h-5 w-5" />
                          {t("library.running")}
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          {t("library.play")}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full gap-2 py-6 text-lg text-secondary"
                      size="lg"
                      onClick={async () => {
                        const exePath = await window.electron.openFileDialog(
                          game.executable
                        );
                        if (exePath) {
                          await window.electron.modifyGameExecutable(
                            game.game || game.name,
                            exePath
                          );
                          const exists = await window.electron.checkFileExists(exePath);
                          setExecutableExists(exists);
                        }
                      }}
                    >
                      <FileSearch className="h-5 w-5" />
                      {t("library.setExecutable")}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleOpenDirectory}
                  >
                    <FolderOpen className="h-5 w-5" />
                    {t("library.openGameDirectory")}
                  </Button>
                </div>

                <Separator />

                {/* Secondary actions */}
                <div className="text-secondary-foreground space-y-3">
                  {settings.ludusavi.enabled && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setBackupDialogOpen(true)}
                    >
                      <FolderSync className="h-4 w-4" />
                      {t("gameScreen.backupSaves")}
                    </Button>
                  )}

                  {!game.isCustom && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setIsVerifyingOpen(true)}
                    >
                      <FileCheck2 className="h-4 w-4" />
                      {t("library.verifyGameFiles")}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={async () => {
                      const success = await window.electron.createGameShortcut(game);
                      if (success) {
                        toast.success(t("library.shortcutCreated"));
                      } else {
                        toast.error(t("library.shortcutError"));
                      }
                    }}
                  >
                    <Monitor className="h-4 w-4" />
                    {t("library.createShortcut")}
                  </Button>

                  {!game.isCustom && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={async () => {
                        const exePath = await window.electron.openFileDialog(
                          game.executable
                        );
                        if (exePath) {
                          await window.electron.modifyGameExecutable(
                            game.game || game.name,
                            exePath
                          );
                          const exists = await window.electron.checkFileExists(exePath);
                          setExecutableExists(exists);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      {t("library.changeExecutable")}
                      {!executableExists && (
                        <AlertTriangle
                          className="h-4 w-4 text-yellow-500"
                          title={t("library.executableNotFound")}
                        />
                      )}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() =>
                      game.isCustom ? handleDeleteGame() : setIsDeleteDialogOpen(true)
                    }
                    disabled={isUninstalling}
                  >
                    <Trash2 className="h-4 w-4" />
                    {game.isCustom
                      ? t("library.removeGameFromLibrary")
                      : t("library.deleteGame")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Game details */}
          <div className="space-y-8 lg:col-span-2">
            {/* Tabs for different sections */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview">
                  <Info className="mr-2 h-4 w-4" />
                  {t("gameScreen.overview")}
                </TabsTrigger>
                {screenshots.length > 0 && (
                  <TabsTrigger value="media">
                    <Monitor className="mr-2 h-4 w-4" />
                    {t("gameScreen.media")}
                  </TabsTrigger>
                )}
                {igdbData && (
                  <TabsTrigger value="details">
                    <Star className="mr-2 h-4 w-4" />
                    {t("gameScreen.details")}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Overview tab */}
              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    {/* Game summary */}
                    {igdbData?.summary ? (
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">{t("gameScreen.summary")}</h2>
                        <p className="leading-relaxed text-muted-foreground">
                          {igdbData.summary}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-4 rounded-full bg-muted p-3">
                          <Info className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">
                          {t("gameScreen.noSummaryAvailable")}
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          {t("gameScreen.noSummaryDescription")}
                        </p>

                        {!igdbData && !igdbLoading && (
                          <Button
                            variant="outline"
                            className="mt-4 gap-2"
                            onClick={() => navigate("/settings")}
                          >
                            <Settings2 className="h-4 w-4" />
                            {t("gameScreen.configureIgdb")}
                          </Button>
                        )}

                        {igdbLoading && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader className="h-4 w-4 animate-spin" />
                            {t("gameScreen.loadingGameInfo")}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Featured screenshots */}
                {screenshots.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold">
                            {t("gameScreen.screenshots")}
                          </h2>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setActiveTab("media")}
                          >
                            {t("gameScreen.viewAll")}
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {screenshots.slice(0, 4).map((screenshot, index) => (
                            <div
                              key={index}
                              className="aspect-video overflow-hidden rounded-lg bg-muted"
                            >
                              <img
                                src={screenshot.formatted_url}
                                alt={`Screenshot ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Basic game info */}
                <Card>
                  <CardContent className="p-6">
                    <h2 className="mb-4 text-xl font-bold">{t("gameScreen.gameInfo")}</h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {game.version && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm text-muted-foreground">
                              {t("library.version")}
                            </span>
                            <p className="text-sm font-medium">{game.version}</p>
                          </div>
                        </div>
                      )}

                      {game.size && (
                        <div className="flex items-center gap-2">
                          <PackageOpen className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm text-muted-foreground">
                              {t("library.size")}
                            </span>
                            <p className="text-sm font-medium">{game.size}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm text-muted-foreground">
                            {t("library.playTime")}
                          </span>
                          <p className="text-sm font-medium">
                            {formatPlaytime(game.playTime)}
                          </p>
                        </div>
                      </div>

                      {game.executable && (
                        <div className="flex items-center gap-3">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <span className="text-sm text-muted-foreground">
                              {t("library.executable").toUpperCase()}
                            </span>
                            <div className="flex items-center gap-2">
                              <p className="max-w-[220px] truncate text-sm font-medium text-foreground">
                                {game.executable.split("\\").pop()}
                              </p>
                              {!executableExists && (
                                <AlertTriangle
                                  className="h-5 w-5 animate-pulse text-red-500"
                                  title={t("library.executableNotFound")}
                                />
                              )}
                            </div>
                            {!executableExists && (
                              <p className="text-sm text-muted-foreground">
                                {t("library.executableNotFound")}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media tab */}
              <TabsContent value="media" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="mb-4 text-xl font-bold">
                      {t("gameScreen.screenshots")}
                    </h2>

                    {screenshots.length > 0 ? (
                      <GameScreenshots screenshots={screenshots} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-4 rounded-full bg-muted p-3">
                          <Monitor className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">
                          {t("gameScreen.noScreenshotsAvailable")}
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          {t("gameScreen.noScreenshotsDescription")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Details tab */}
              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    {igdbData ? (
                      <GameMetadata gameInfo={igdbData} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="mb-4 rounded-full bg-muted p-3">
                          <Star className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">
                          {t("gameScreen.noDetailsAvailable")}
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          {t("gameScreen.noDetailsDescription")}
                        </p>

                        {!igdbData && !igdbLoading && (
                          <Button
                            variant="outline"
                            className="mt-4 gap-2"
                            onClick={() => navigate("/settings")}
                          >
                            <Settings2 className="h-4 w-4" />
                            {t("gameScreen.configureIgdb")}
                          </Button>
                        )}

                        {igdbLoading && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader className="h-4 w-4 animate-spin" />
                            {t("gameScreen.loadingGameInfo")}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Storyline if available */}
                {igdbData?.storyline && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">{t("gameScreen.storyline")}</h2>
                        <p className="leading-relaxed text-muted-foreground">
                          {igdbData.storyline}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <VerifyingGameDialog
        game={game}
        open={isVerifyingOpen}
        onOpenChange={setIsVerifyingOpen}
      />

      <GamesBackupDialog
        game={game}
        open={backupDialogOpen}
        onOpenChange={setBackupDialogOpen}
      />

      {ratingGame && (
        <GameRate
          game={ratingGame}
          isOpen={showRateDialog}
          onClose={() => {
            setShowRateDialog(false);
            setRatingGame(null);
          }}
        />
      )}

      {/* VR Warning Dialog */}
      <AlertDialog
        open={showVrWarning}
        onOpenChange={open => {
          setShowVrWarning(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("library.vrWarning.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("library.vrWarning.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className="text-xs text-primary"
              onClick={() => {
                setShowVrWarning(false);
                window.electron.openURL(
                  "https://ascendara.app/docs/troubleshooting/vr-games"
                );
              }}
            >
              {t("library.vrWarning.learnMore")}
            </Button>
            <Button
              className="text-secondary"
              onClick={() => {
                setShowVrWarning(false);
                handlePlayGame(true);
              }}
            >
              {t("library.vrWarning.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Online Fix Warning Dialog */}
      <AlertDialog open={showOnlineFixWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("download.onlineFixWarningTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("download.onlineFixWarningDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOnlineFixWarning(false);
                handlePlayGame(true);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {t("common.ok")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <ErrorDialog
        open={showErrorDialog}
        onClose={handleCloseErrorDialog}
        errorGame={errorGame}
        errorMessage={errorMessage}
        t={t}
      />

      {/* Uninstall Confirmation Dialog */}
      <UninstallConfirmationDialog
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteGame}
        gameName={game.game}
        open={isDeleteDialogOpen}
        isUninstalling={isUninstalling}
        t={t}
      />
    </div>
  );
}
