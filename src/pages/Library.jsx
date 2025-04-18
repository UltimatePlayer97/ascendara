import React, { useState, useEffect, useRef, memo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import {
  Plus,
  FolderOpen,
  ExternalLink,
  Pencil,
  User,
  HardDrive,
  Gamepad2,
  Gift,
  Search as SearchIcon,
  AlertTriangle,
  Heart,
  SquareLibrary,
  Tag,
  PackageOpen,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogCancel,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import gameService from "@/services/gameService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import igdbService from "@/services/gameInfoService";

const Library = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastLaunchedGame, setLastLaunchedGame] = useState(null);
  const lastLaunchedGameRef = useRef(null);
  const [isOnWindows, setIsOnWindows] = useState(true);
  const [coverSearchQuery, setCoverSearchQuery] = useState("");
  const [coverSearchResults, setCoverSearchResults] = useState([]);
  const [isCoverSearchLoading, setIsCoverSearchLoading] = useState(false);
  const [selectedGameImage, setSelectedGameImage] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [username, setUsername] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem("game-favorites");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [totalGamesSize, setTotalGamesSize] = useState(0);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("game-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const checkWindows = async () => {
      const isWindows = await window.electron.isOnWindows();
      setIsOnWindows(isWindows);
    };
    checkWindows();
  }, []);

  // Username event listeners removed - Library only needs to display username

  useEffect(() => {
    // Add keyframes to document
    const styleSheet = document.styleSheets[0];
    const keyframes = `
      @keyframes shimmer {
        0% { transform: translateX(-100%) }
        100% { transform: translateX(100%) }
      }
    `;
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  }, []);

  useEffect(() => {
    lastLaunchedGameRef.current = lastLaunchedGame;
  }, [lastLaunchedGame]);

  const toggleFavorite = gameName => {
    setFavorites(prev => {
      const newFavorites = prev.includes(gameName)
        ? prev.filter(name => name !== gameName)
        : [...prev, gameName];
      return newFavorites;
    });
  };

  const fetchUsername = async () => {
    try {
      // Get username from localStorage with fallback to API
      const userPrefs = JSON.parse(localStorage.getItem("userProfile") || "{}");
      if (userPrefs.profileName) {
        setUsername(userPrefs.profileName);
        return userPrefs.profileName;
      }

      // Fallback to Electron API if not in localStorage
      const crackedUsername = await window.electron.getLocalCrackUsername();
      setUsername(crackedUsername || "Guest");
      return crackedUsername;
    } catch (error) {
      console.error("Error fetching username:", error);
      setUsername("Guest");
      return null;
    }
  };

  const formatBytes = bytes => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  useEffect(() => {
    const fetchStorageInfo = async () => {
      try {
        const installPath = await window.electron.getDownloadDirectory();
        if (installPath) {
          const [driveSpace, gamesSize] = await Promise.all([
            window.electron.getDriveSpace(installPath),
            window.electron.getInstalledGamesSize(),
          ]);

          setStorageInfo(driveSpace);

          if (gamesSize.success) {
            setIsCalculatingSize(gamesSize.calculating);
            if (!gamesSize.calculating) {
              setTotalGamesSize(gamesSize.totalSize);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching storage info:", error);
      }
    };

    fetchStorageInfo();
  }, []);

  useEffect(() => {
    fetchUsername();
  }, []);

  // Keep track of whether we've initialized
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize once on mount
  useEffect(() => {
    const init = async () => {
      await loadGames();
      setIsInitialized(true);
    };
    init();
  }, []);

  const loadGames = async () => {
    try {
      // Get games from main process
      const installedGames = await window.electron.getGames();
      const customGames = await window.electron.getCustomGames();

      // Filter out games that are being verified or downloading
      const filteredInstalledGames = installedGames.filter(
        game =>
          !game.downloadingData?.verifying &&
          !game.downloadingData?.downloading &&
          !game.downloadingData?.extracting &&
          !game.downloadingData?.updating &&
          !game.downloadingData?.stopped &&
          (!game.downloadingData?.verifyError ||
            game.downloadingData.verifyError.length === 0)
      );

      // Combine both types of games
      const allGames = [
        ...(filteredInstalledGames || []).map(game => ({
          ...game,
          isCustom: false,
        })),
        ...(customGames || []).map(game => ({
          name: game.game,
          game: game.game, // Keep original property for compatibility
          version: game.version,
          online: game.online,
          dlc: game.dlc,
          isVr: game.isVr,
          executable: game.executable,
          playTime: game.playTime,
          isCustom: true,
          custom: true,
        })),
      ];

      setGames(allGames);
      setLoading(false);
    } catch (error) {
      console.error("Error loading games:", error);
      setError("Failed to load games");
      setLoading(false);
    }
  };

  const handlePlayGame = async game => {
    navigate("/gamescreen", {
      state: {
        gameData: game,
      },
    });
  };

  const searchGameCovers = async query => {
    if (!query.trim()) {
      setCoverSearchResults([]);
      return;
    }

    setIsCoverSearchLoading(true);
    try {
      const gameDetails = await igdbService.getGameDetails(query);
      // Transform the results to match the expected format
      const results = gameDetails
        .map(game => ({
          id: game.id,
          url:
            game.screenshots && game.screenshots.length > 0
              ? igdbService.formatImageUrl(game.screenshots[0].url, "screenshot_big")
              : null,
          name: game.name,
        }))
        .filter(game => game.url); // Only include games with screenshots
      setCoverSearchResults(results);
    } catch (error) {
      console.error("Error searching game covers:", error);
      setCoverSearchResults([]);
    } finally {
      setIsCoverSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchGameCovers(coverSearchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [coverSearchQuery, searchGameCovers]); // Add searchGameCovers dependency

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // Filter games based on search query
  const filteredGames = games
    .slice()
    .sort((a, b) => {
      const aName = a.game || a.name;
      const bName = b.game || b.name;
      const aFavorite = favorites.includes(aName);
      const bFavorite = favorites.includes(bName);

      // If both are favorites or both are not favorites, sort alphabetically
      if (aFavorite === bFavorite) {
        return aName.localeCompare(bName);
      }
      // If a is favorite and b is not, a comes first
      return aFavorite ? -1 : 1;
    })
    .filter(game => {
      const searchLower = searchQuery.toLowerCase();
      return (game.game || game.name).toLowerCase().includes(searchLower);
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        {error && (
          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-4">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col">
            <div className="flex flex-row items-start justify-between">
              {/* Left side: Title and Search */}
              <div className="flex-1">
                <div className="mb-4 mt-6 flex items-center">
                  <h1 className="text-4xl font-bold tracking-tight text-primary">
                    {t("library.pageTitle")}
                  </h1>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mb-2 ml-2 flex h-6 w-6 cursor-help items-center justify-center rounded-full bg-muted hover:bg-muted/80">
                          <span className="text-sm font-medium">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="space-y-2 p-4 text-secondary"
                      >
                        <p className="font-semibold">{t("library.iconLegend.header")}</p>
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.onlineFix")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.allDlcs")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-secondary"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V17C22 18.1046 21.1046 19 20 19H16.1324C15.4299 19 14.7788 18.6314 14.4174 18.029L12.8575 15.4292C12.4691 14.7818 11.5309 14.7818 11.1425 15.4292L9.58261 18.029C9.22116 18.6314 8.57014 19 7.86762 19H4C2.89543 19 2 18.1046 2 17V10Z"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M3.81253 6.7812C4.5544 5.6684 5.80332 5 7.14074 5H16.8593C18.1967 5 19.4456 5.6684 20.1875 6.7812L21 8H3L3.81253 6.7812Z"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>{" "}
                          <span>{t("library.iconLegend.vrGame")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PackageOpen className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.size")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.version")}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="relative mr-12">
                  <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t("library.searchLibrary")}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Right side: Storage Info and Settings */}
              <div className="flex items-start gap-4">
                <div className="min-w-[250px] rounded-lg bg-secondary/10 p-3">
                  <div className="space-y-3">
                    {/* Username section */}
                    <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{username || "Guest"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => navigate("/profile")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SquareLibrary className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {t("library.gamesInLibrary")}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{games.length}</span>
                    </div>

                    {/* Storage section */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {t("library.availableSpace")}
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {storageInfo ? (
                            formatBytes(storageInfo.freeSpace)
                          ) : (
                            <Loader className="h-4 w-4 animate-spin" />
                          )}
                        </span>
                      </div>
                      <div className="relative mb-2">
                        {/* Ascendara Games Space */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute left-0 top-0 h-2 cursor-help rounded-l-full bg-primary"
                                style={{
                                  width: `${storageInfo ? (totalGamesSize / storageInfo.totalSpace) * 100 : 0}%`,
                                  zIndex: 2,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-secondary">
                              {t("library.spaceTooltip.games", {
                                size: formatBytes(totalGamesSize),
                              })}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Other Used Space */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute left-0 top-0 h-2 cursor-help rounded-r-full bg-muted"
                                style={{
                                  width: `${storageInfo ? ((storageInfo.totalSpace - storageInfo.freeSpace) / storageInfo.totalSpace) * 100 : 0}%`,
                                  zIndex: 1,
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-secondary">
                              {t("library.spaceTooltip.other", {
                                size: formatBytes(
                                  storageInfo
                                    ? storageInfo.totalSpace -
                                        storageInfo.freeSpace -
                                        totalGamesSize
                                    : 0
                                ),
                              })}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Background */}
                        <div className="h-2 w-full rounded-full bg-muted/30" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t("library.gamesSpace")}:{" "}
                          {isCalculatingSize ? (
                            t("library.calculatingSize")
                          ) : storageInfo ? (
                            formatBytes(totalGamesSize)
                          ) : (
                            <Loader className="h-4 w-4 animate-spin" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AlertDialog
              key="add-game-dialog"
              open={isAddGameOpen}
              onOpenChange={setIsAddGameOpen}
            >
              <AlertDialogTrigger asChild>
                <AddGameCard />
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-background sm:max-w-[425px]">
                <AlertDialogHeader className="space-y-2">
                  <AlertDialogTitle className="text-2xl font-bold text-foreground">
                    {t("library.addGame")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground">
                    {t("library.addGameDescription2")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="max-h-[60vh] overflow-y-auto py-4">
                  <AddGameForm
                    onSuccess={() => {
                      setIsAddGameOpen(false);
                      setSelectedGameImage(null);
                      loadGames();
                    }}
                  />
                </div>
              </AlertDialogContent>
            </AlertDialog>

            {filteredGames.map(game => (
              <div key={game.game || game.name}>
                <InstalledGameCard
                  game={game}
                  onPlay={() => handlePlayGame(game)}
                  favorites={favorites}
                  onToggleFavorite={() => toggleFavorite(game.game || game.name)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AddGameCard = React.forwardRef((props, ref) => {
  const { t } = useLanguage();
  return (
    <Card
      ref={ref}
      className={cn(
        "group relative overflow-hidden transition-colors",
        "cursor-pointer border-2 border-dashed border-muted hover:border-primary"
      )}
      {...props}
    >
      <CardContent className="flex h-full min-h-[240px] flex-col items-center justify-center p-6 text-muted-foreground group-hover:text-primary">
        <div className="rounded-full bg-muted p-6 group-hover:bg-primary/10">
          <Plus className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("library.addGame")}</h3>
        <p className="mt-2 text-center text-sm">{t("library.addGameDescription1")}</p>
      </CardContent>
    </Card>
  );
});

AddGameCard.displayName = "AddGameCard";

const InstalledGameCard = memo(
  ({ game, onPlay, isSelected, favorites, onToggleFavorite }) => {
    const { t } = useLanguage();
    const [isRunning, setIsRunning] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [imageData, setImageData] = useState(null);
    const [executableExists, setExecutableExists] = useState(null);
    const isFavorite = favorites.includes(game.game || game.name);

    useEffect(() => {
      const checkExecutable = async () => {
        if (game.executable && !game.isCustom) {
          try {
            const execPath = `${game.game}/${game.executable}`;
            const exists = await window.electron.checkFileExists(execPath);
            setExecutableExists(exists);
          } catch (error) {
            console.error("Error checking executable:", error);
            setExecutableExists(false);
          }
        }
      };

      checkExecutable();
    }, [game.executable, game.isCustom, game.game]);

    // Check game running status periodically
    useEffect(() => {
      let isMounted = true;
      const gameId = game.game || game.name;

      const checkGameStatus = async () => {
        try {
          if (!isMounted) return;
          const running = await window.electron.isGameRunning(gameId);
          if (isMounted) {
            setIsRunning(running);
          }
        } catch (error) {
          console.error("Error checking game status:", error);
        }
      };

      // Initial check
      checkGameStatus();

      // Set up interval for periodic checks - reduced frequency to 3 seconds
      const interval = setInterval(checkGameStatus, 3000);

      // Cleanup function
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [game.game, game.name]); // Only depend on game ID properties

    // Load game image
    useEffect(() => {
      let isMounted = true;
      const gameId = game.game || game.name;

      const loadGameImage = async () => {
        try {
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
    }, [game.game, game.name]); // Only depend on game ID properties

    return (
      <>
        <Card
          className={cn(
            "group relative overflow-hidden transition-all duration-200",
            "hover:-translate-y-1 hover:shadow-lg",
            isSelected && "ring-2 ring-primary",
            "cursor-pointer"
          )}
          onClick={onPlay}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <CardContent className="p-0">
            <div className="relative aspect-[4/3]">
              <img
                src={imageData}
                alt={game.game}
                className="h-full w-full object-cover"
              />
              <div
                className={cn(
                  "absolute inset-0 to-transparent",
                  "opacity-0 transition-opacity group-hover:opacity-100",
                  "flex flex-col justify-end p-4 text-secondary"
                )}
              >
                <div className="absolute right-4 top-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 hover:text-primary"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleFavorite(game.game || game.name);
                    }}
                  >
                    <Heart
                      className={cn(
                        "h-6 w-6",
                        isFavorite ? "fill-primary text-primary" : "fill-none text-white"
                      )}
                    />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">{game.game}</h3>
                {game.online && <Gamepad2 className="h-4 w-4 text-muted-foreground" />}
                {game.dlc && <Gift className="h-4 w-4 text-muted-foreground" />}
                {game.isVr && (
                  <svg
                    className="p-0.5 text-foreground"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
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
                {executableExists === true && (
                  <AlertTriangle
                    className="h-4 w-4 text-yellow-500"
                    title={t("library.executableNotFound")}
                  />
                )}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {game.playTime !== undefined ? (
                  <span className="font-medium md:text-xs">
                    {game.playTime < 60
                      ? t("library.lessThanMinute")
                      : game.playTime < 120
                        ? `1 ${t("library.minute")} ${t("library.ofPlaytime")}`
                        : game.playTime < 3600
                          ? `${Math.floor(game.playTime / 60)} ${t("library.minutes")} ${t("library.ofPlaytime")}`
                          : game.playTime < 7200
                            ? `1 ${t("library.hour")} ${t("library.ofPlaytime")}`
                            : `${Math.floor(game.playTime / 3600)} ${t("library.hours")} ${t("library.ofPlaytime")}`}
                  </span>
                ) : (
                  <span className="font-medium md:text-xs">
                    {t("library.neverPlayed")}
                  </span>
                )}
              </p>
            </div>
          </CardFooter>
        </Card>
      </>
    );
  }
);

InstalledGameCard.displayName = "InstalledGameCard";

const AddGameForm = ({ onSuccess }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    executable: "",
    name: "",
    hasVersion: false,
    version: "",
    isOnline: false,
    hasDLC: false,
  });
  const [coverSearch, setCoverSearch] = useState({
    query: "",
    isLoading: false,
    results: [],
    selectedCover: null,
  });

  // Add debounce timer ref
  const searchDebounceRef = useRef(null);
  const minSearchLength = 2;

  const handleCoverSearch = async query => {
    // Update query immediately for UI responsiveness
    setCoverSearch(prev => ({ ...prev, query }));

    // Clear previous timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Don't search if query is too short
    if (!query.trim() || query.length < minSearchLength) {
      setCoverSearch(prev => ({ ...prev, results: [], isLoading: false }));
      return;
    }

    // Set up new debounce timer
    searchDebounceRef.current = setTimeout(async () => {
      setCoverSearch(prev => ({ ...prev, isLoading: true }));
      try {
        const results = await gameService.searchGameCovers(query);
        setCoverSearch(prev => ({
          ...prev,
          results: results.slice(0, 9),
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error searching covers:", error);
        setCoverSearch(prev => ({ ...prev, isLoading: false }));
        toast.error(t("library.coverSearchError"));
      }
    }, 300); // 300ms debounce
  };

  const handleChooseExecutable = async () => {
    const file = await window.electron.openFileDialog();
    if (file) {
      setFormData(prev => ({
        ...prev,
        executable: file,
        name: file.split("\\").pop().replace(".exe", ""),
      }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    await window.electron.addGame(
      formData.name,
      formData.isOnline,
      formData.hasDLC,
      formData.version,
      formData.executable,
      coverSearch.selectedCover?.imgID
    );
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start truncate bg-background text-left font-normal text-primary hover:bg-accent"
            onClick={handleChooseExecutable}
          >
            <FolderOpen className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {formData.executable || t("library.chooseExecutableFile")}
            </span>
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">
            {t("library.gameName")}
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="border-input bg-background text-foreground"
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasVersion" className="flex-1 text-foreground">
              {t("library.version")}
            </Label>
            <Switch
              id="hasVersion"
              checked={formData.hasVersion}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  hasVersion: checked,
                  version: !checked ? "" : prev.version,
                }))
              }
            />
          </div>

          {formData.hasVersion && (
            <Input
              id="version"
              value={formData.version}
              onChange={e => setFormData(prev => ({ ...prev, version: e.target.value }))}
              placeholder={t("library.versionPlaceholder")}
              className="border-input bg-background text-foreground"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isOnline" className="flex-1 text-foreground">
            {t("library.hasOnlineFix")}
          </Label>
          <Switch
            id="isOnline"
            checked={formData.isOnline}
            onCheckedChange={checked =>
              setFormData(prev => ({ ...prev, isOnline: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hasDLC" className="flex-1 text-foreground">
            {t("library.includesAllDLCs")}
          </Label>
          <Switch
            id="hasDLC"
            checked={formData.hasDLC}
            onCheckedChange={checked =>
              setFormData(prev => ({ ...prev, hasDLC: checked }))
            }
          />
        </div>

        {/* Game Cover Search Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-5 transform text-muted-foreground" />
              <Input
                id="coverSearch"
                value={coverSearch.query}
                onChange={e => handleCoverSearch(e.target.value)}
                className="border-input bg-background pl-8 text-foreground"
                placeholder={t("library.searchGameCover")}
                minLength={minSearchLength}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("library.searchGameCoverNotice")}
              </p>
            </div>
          </div>

          {/* Cover Search Results */}
          {coverSearch.query.length < minSearchLength ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {t("library.enterMoreChars", { count: minSearchLength })}
            </div>
          ) : coverSearch.isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : coverSearch.results.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {coverSearch.results.map((cover, index) => (
                <div
                  key={index}
                  onClick={() =>
                    setCoverSearch(prev => ({ ...prev, selectedCover: cover }))
                  }
                  className={cn(
                    "relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                    coverSearch.selectedCover === cover
                      ? "border-primary shadow-lg"
                      : "border-transparent hover:border-primary/50"
                  )}
                >
                  <img
                    src={gameService.getImageUrl(cover.imgID)}
                    alt={cover.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100">
                    <p className="px-2 text-center text-sm text-white">{cover.title}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {t("library.noResultsFound")}
            </div>
          )}

          {/* Selected Cover Preview */}
          {coverSearch.selectedCover && (
            <div className="mt-4 flex justify-center">
              <div className="relative aspect-video w-64 overflow-hidden rounded-lg border-2 border-primary">
                <img
                  src={gameService.getImageUrl(coverSearch.selectedCover.imgID)}
                  alt={coverSearch.selectedCover.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialogFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onSuccess()} className="text-primary">
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.executable || !formData.name}
          className="bg-primary text-secondary"
        >
          {t("library.addGame")}
        </Button>
      </AlertDialogFooter>
    </div>
  );
};

export default Library;
