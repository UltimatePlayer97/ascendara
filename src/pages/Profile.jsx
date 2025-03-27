import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import UsernameDialog from "@/components/UsernameDialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Trophy,
  Clock,
  Smile,
  Timer,
  Archive,
  FileDown,
  Trash2,
  HelpCircle,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import LevelingCard from "@/components/LevelingCard";
import { cn } from "@/lib/utils";

const Profile = () => {
  const { t } = useLanguage();
  const [joinDate, setJoinDate] = useState("");
  const [username, setUsername] = useState("");
  const [useGoldbergName, setUseGoldbergName] = useState(true);
  const [generalUsername, setGeneralUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(() => {
    return localStorage.getItem("selectedEmoji") || "😊";
  });
  const [profileImage, setProfileImage] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    totalPlayTime: 0,
    favoriteGames: [],
    totalPlaytime: 0,
    totalGames: 0,
    level: 1,
    xp: 0,
    currentXP: 0,
    nextLevelXp: 100,
    gamesCompleted: 0,
    totalDownloads: 0,
    achievements: [],
    recentActivity: [],
    favoriteGenres: [],
    genreDistribution: {},
  });
  const [gameImages, setGameImages] = useState({});
  const [downloadHistory, setDownloadHistory] = useState([]);

  useEffect(() => {
    localStorage.setItem("selectedEmoji", selectedEmoji);
  }, [selectedEmoji]);

  // Calculate profile statistics based on games data
  const calculateProfileStats = (games, customGames) => {
    const allGames = [...(games || []), ...(customGames || [])];

    // Calculate total playtime and XP from games
    let totalXP = 0;
    let totalPlaytime = 0;

    allGames.forEach(game => {
      // Base XP for having the game - reduced to make progression more balanced
      let gameXP = 50; // Base XP for each game

      // XP from playtime - more reasonable scaling
      const playtimeHours = (game.playTime || 0) / 3600;
      gameXP += Math.floor(playtimeHours * 25); // 25 XP per hour of playtime

      // XP from launches - smaller contribution
      gameXP += Math.min((game.launchCount || 0) * 5, 50);

      // Bonus XP for completed games
      if (game.completed) {
        gameXP += 75; // Bonus XP for completing a game
      }

      totalXP += gameXP;
      totalPlaytime += game.playTime || 0;
    });

    // Add milestone bonuses based on total playtime - reduced to prevent excessive XP
    const totalPlaytimeHours = totalPlaytime / 3600;

    // Milestone bonuses for reaching certain playtime thresholds
    if (totalPlaytimeHours >= 50) totalXP += 200;
    if (totalPlaytimeHours >= 100) totalXP += 300;
    if (totalPlaytimeHours >= 200) totalXP += 500;
    if (totalPlaytimeHours >= 500) totalXP += 1000;

    // New level calculation with a much more reasonable curve
    // Using a common RPG-style formula where each level requires a bit more XP than the last
    // but the curve is much gentler

    // Base XP needed for level 2
    const baseXP = 100;

    // Calculate level directly from total XP using a formula
    // This formula creates a curve where early levels are easy to get
    // and higher levels require progressively more XP, but not exponentially more

    // Ensure we never go below level 1, even with 0 XP
    let level = Math.max(1, Math.floor(1 + Math.sqrt(totalXP / baseXP)));

    // Cap at level 999
    level = Math.min(level, 999);

    // Calculate XP needed for current and next level
    // For level 1, xpForCurrentLevel should be 0
    const xpForCurrentLevel = level <= 1 ? 0 : baseXP * Math.pow(level, 2);
    const xpForNextLevel = baseXP * Math.pow(level + 1, 2);
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;

    // Calculate current XP progress toward next level
    // Ensure this is never negative
    const currentLevelProgress = Math.max(0, totalXP - xpForCurrentLevel);

    // Handle max level case
    if (level >= 999) {
      // At max level, show full progress
      return {
        totalPlaytime,
        gamesPlayed: allGames.filter(game => game.playTime > 0).length,
        totalGames: allGames.length,
        level: 999,
        xp: totalXP,
        currentXP: 100,
        nextLevelXp: 100, // Set equal values to show full progress bar
        allGames,
      };
    }

    return {
      totalPlaytime,
      gamesPlayed: allGames.filter(game => game.playTime > 0).length,
      totalGames: allGames.length,
      level,
      xp: totalXP,
      currentXP: currentLevelProgress,
      nextLevelXp: xpNeededForNextLevel,
      allGames,
    };
  };

  const emojiCategories = [
    {
      id: "gaming",
      title: "Gaming",
      emojis: [
        "🎮",
        "🕹️",
        "👾",
        "🎲",
        "🎯",
        "⚔️",
        "🛡️",
        "🏆",
        "🎪",
        "🎨",
        "🎭",
        "🎢",
        "🔥",
        "💎",
      ],
    },
    {
      id: "faces",
      title: "Expressions",
      emojis: [
        "😊",
        "😎",
        "🤔",
        "😄",
        "😂",
        "🥹",
        "🥰",
        "😇",
        "🤩",
        "🤗",
        "🫡",
        "🤭",
        "🫢",
        "😌",
        "😏",
      ],
    },
    {
      id: "tech",
      title: "Tech",
      emojis: [
        "💻",
        "⌨️",
        "🖥️",
        "🖱️",
        "📱",
        "⚡",
        "💡",
        "🔧",
        "⚙️",
        "🛠️",
        "💾",
        "📡",
        "🔌",
        "🖨️",
        "📺",
      ],
    },
    {
      id: "space",
      title: "Space & Magic",
      emojis: [
        "⭐",
        "✨",
        "💫",
        "☄️",
        "🌙",
        "🌎",
        "🌍",
        "🌏",
        "🪐",
        "🌠",
        "🌌",
        "🔮",
        "🎇",
        "🌈",
        "🌟",
      ],
    },
    {
      id: "audio",
      title: "Audio",
      emojis: [
        "🎵",
        "🎶",
        "🎼",
        "🎹",
        "🥁",
        "🎸",
        "🎺",
        "🎻",
        "🪘",
        "🎧",
        "🔊",
        "📻",
        "🎙️",
        "🎚️",
        "🎛️",
      ],
    },
  ];

  const handleEmojiSelect = emoji => {
    setSelectedEmoji(emoji);
  };

  const getDisplayUsername = () => {
    // Use the generalUsername state which is properly synced during loadProfile
    return generalUsername || "Guest";
  };

  useEffect(() => {
    loadProfile();
    loadProfileImage();

    // Add event listener to reload profile when username is updated
    const handleProfileUpdate = () => {
      loadProfile();
    };

    // Listen for storage events (when localStorage changes in other tabs)
    window.addEventListener("storage", handleProfileUpdate);

    // Listen for username update event
    window.addEventListener("username-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("username-updated", handleProfileUpdate);
    };
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // Get timestamp for join date
      const joinDate = await window.electron.timestampTime();
      setJoinDate(joinDate);

      // Get games directly from the file system
      const games = await loadGamesData();

      // Get download history
      const history = await window.electron.getDownloadHistory();
      setDownloadHistory(history);

      // Calculate statistics directly in the component
      const calculatedStats = calculateProfileStats(games, []);

      setStats({
        ...calculatedStats,
        totalPlayTime: calculatedStats.totalPlaytime || 0,
        xp: calculatedStats.xp || 0,
        currentXP: calculatedStats.currentXP || 0,
        nextLevelXp: calculatedStats.nextLevelXp || 100,
        level: calculatedStats.level || 1,
        gamesPlayed: calculatedStats.gamesPlayed || 0,
        totalGames: calculatedStats.totalGames || 0,
      });

      setGames(games);

      // Load user preferences from localStorage
      const userPrefs = JSON.parse(localStorage.getItem("userProfile") || "{}");

      // Check if profileName is missing but cracked username exists
      if (!userPrefs.profileName) {
        try {
          // Try to get the cracked username
          const crackedUsername = await window.electron.getLocalCrackUsername();
          if (crackedUsername) {
            // Update userPrefs with the cracked username
            userPrefs.profileName = crackedUsername;
            // Save updated preferences to localStorage
            localStorage.setItem("userProfile", JSON.stringify(userPrefs));
            // Dispatch event to notify other components
            window.dispatchEvent(new Event("username-updated"));
          }
        } catch (error) {
          console.error("Error fetching cracked username:", error);
        }
      }

      // Set username values based on localStorage
      setUsername(userPrefs.username || "");
      setGeneralUsername(userPrefs.profileName || "");
      setUseGoldbergName(userPrefs.useForGoldberg ?? true);

      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  };

  // New function to load games data directly
  const loadGamesData = async () => {
    try {
      // Get settings to find download directory
      const settings = await window.electron.getSettings();
      if (!settings || !settings.downloadDirectory) {
        return [];
      }

      // Get installed games
      const installedGames = await window.electron.getGames();

      // Get custom games if available
      let customGames = [];
      try {
        customGames = await window.electron.getCustomGames();
      } catch (error) {
        console.error("Error loading custom games:", error);
      }

      // Combine all games
      return [...installedGames, ...customGames];
    } catch (error) {
      console.error("Error loading games data:", error);
      return [];
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    // Load game images
    const loadGameImages = async () => {
      const images = {};
      for (const game of games) {
        try {
          const gameId = game.game || game.name;
          const imageBase64 = await window.electron.getGameImage(gameId);
          if (imageBase64) {
            images[gameId] = `data:image/jpeg;base64,${imageBase64}`;
          }
        } catch (error) {
          console.error("Error loading game image:", error);
        }
      }
      setGameImages(images);
    };

    if (games.length > 0) {
      loadGameImages();
    }
  }, [games]);

  const handleImageUpload = async e => {
    const file = e.target.files[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onload = async event => {
          const base64 = event.target.result;
          const result = await window.electron.uploadProfileImage(base64);
          if (result.success) {
            setProfileImage(base64);
            localStorage.setItem("profileImage", base64);
            localStorage.setItem("useEmoji", "false");
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }
  };

  const switchToEmoji = emoji => {
    setSelectedEmoji(emoji);
    setProfileImage(null);
    localStorage.removeItem("profileImage");
    localStorage.setItem("useEmoji", "true");
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem("profileImage");
    localStorage.setItem("useEmoji", "true");
  };

  const loadProfileImage = async () => {
    try {
      const useEmoji = localStorage.getItem("useEmoji") !== "false";
      if (useEmoji) {
        setProfileImage(null);
        return;
      }

      const savedImage = localStorage.getItem("profileImage");
      if (savedImage) {
        setProfileImage(savedImage);
      } else {
        const image = await window.electron.getProfileImage();
        if (image) {
          const base64 = `data:image/png;base64,${image}`;
          setProfileImage(base64);
          localStorage.setItem("profileImage", base64);
        }
      }
    } catch (error) {
      console.error("Error loading profile image:", error);
    }
  };

  const renderProfileSection = () => {
    const isUsingEmoji = !profileImage;

    return (
      <div className="relative">
        <div className="flex items-center gap-4 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <div
                className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-border bg-card text-4xl shadow-lg transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:opacity-90 hover:shadow-xl"
                style={
                  profileImage
                    ? {
                        backgroundImage: `url(${profileImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}
                }
              >
                {!profileImage && selectedEmoji}
                <div className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 shadow-md">
                  <Smile className="h-4 w-4 text-secondary" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-4" align="start" sideOffset={5}>
              <div className="space-y-5">
                {/* Current Display */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-background ring-1 ring-border">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{selectedEmoji}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {profileImage
                          ? t("profile.customImage")
                          : t("profile.usingEmoji")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profileImage
                          ? t("profile.switchToEmoji")
                          : t("profile.orUploadImage")}
                      </p>
                    </div>
                  </div>
                  {profileImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={removeProfileImage}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Upload Image */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="profile-image-upload"
                  />
                  <Button
                    variant="outline"
                    className="flex h-9 w-full items-center justify-center gap-2 hover:bg-accent/50"
                    onClick={() =>
                      document.getElementById("profile-image-upload").click()
                    }
                  >
                    <Upload className="h-4 w-4" />
                    <span className="font-medium">{t("profile.uploadImage")}</span>
                  </Button>
                </div>

                <Separator />

                {/* Emoji Selection */}
                <div className="space-y-3">
                  <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-4">
                      {emojiCategories.map(category => (
                        <div key={category.id} className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            {category.title}
                          </h4>
                          <div className="grid grid-cols-6 gap-2">
                            {category.emojis.map((emoji, index) => (
                              <Button
                                key={`${category.id}-${emoji}-${index}`}
                                variant={
                                  selectedEmoji === emoji && !profileImage
                                    ? "secondary"
                                    : "ghost"
                                }
                                className={cn(
                                  "h-10 text-xl transition-all duration-200",
                                  "hover:scale-105 hover:bg-accent/80",
                                  selectedEmoji === emoji &&
                                    !profileImage &&
                                    "ring-1 ring-primary"
                                )}
                                onClick={() => switchToEmoji(emoji)}
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{getDisplayUsername()}</h2>
              <div className="mb-1">
                <UsernameDialog />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatPlayTime = seconds => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  };

  const sortedGames = useMemo(() => {
    return [...games]
      .filter(game => game.playTime && game.playTime >= 60) // Only show games with 1+ minutes of playtime
      .sort((a, b) => (b.playTime || 0) - (a.playTime || 0));
  }, [games]);

  // Calculate playtime statistics
  const playtimeStats = useMemo(() => {
    if (!sortedGames.length) return null;

    const totalPlaytime = sortedGames.reduce(
      (sum, game) => sum + (game.playTime || 0),
      0
    );
    const avgPlaytime = totalPlaytime / sortedGames.length;
    const mostPlayed = sortedGames[0];

    // Calculate playtime distribution for last 5 games
    const recentGames = sortedGames.slice(0, 5).map(game => ({
      name: game.game || game.name,
      playTime: game.playTime || 0,
      percentage: ((game.playTime || 0) / totalPlaytime) * 100,
    }));

    return {
      totalPlaytime,
      avgPlaytime,
      mostPlayed,
      recentGames,
    };
  }, [sortedGames]);

  // Function to save user profile preferences to localStorage
  const saveUserPreferences = data => {
    try {
      const currentPrefs = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const updatedPrefs = { ...currentPrefs, ...data };
      localStorage.setItem("userProfile", JSON.stringify(updatedPrefs));
      return true;
    } catch (error) {
      console.error("Error saving user preferences:", error);
      return false;
    }
  };

  // Format date to a more readable format
  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto space-y-8 p-4">
      {/* Banner Section */}
      <div className="relative mt-12 h-48 overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-card">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">{renderProfileSection()}</div>
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="mt-2 text-muted-foreground">
          {t("profile.memberSince", { date: joinDate })}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("profile.totalPlaytime")}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {playtimeStats ? formatPlayTime(playtimeStats.totalPlaytime) : "0h"}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profile.acrossGames", { count: sortedGames.length })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("profile.avgSession")}
              </CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {playtimeStats ? formatPlayTime(playtimeStats.avgPlaytime) : "0h"}
              </div>
              <p className="text-xs text-muted-foreground">{t("profile.perGameAvg")}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("profile.mostPlayed")}
              </CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="truncate text-2xl font-bold">
                {playtimeStats?.mostPlayed
                  ? playtimeStats.mostPlayed.game || playtimeStats.mostPlayed.name
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                {playtimeStats?.mostPlayed
                  ? formatPlayTime(playtimeStats.mostPlayed.playTime)
                  : t("profile.noGames")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Level Progress */}
        <LevelingCard
          level={stats.level}
          currentXP={stats.currentXP}
          nextLevelXp={stats.nextLevelXp}
          totalXP={stats.xp}
        />

        {/* Playtime Distribution */}
        {playtimeStats && playtimeStats.recentGames.length > 0 && (
          <Card className="col-span-full bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("profile.topGames")}</CardTitle>
              <CardDescription>{t("profile.playTimeDistribution")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {playtimeStats.recentGames.map(game => (
                  <div key={game.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex-1 truncate font-medium">{game.name}</span>
                      <span className="text-muted-foreground">
                        {formatPlayTime(game.playTime)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${game.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Games List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t("profile.games")}</h2>
            <span className="text-sm text-muted-foreground">
              {sortedGames.length} {t("profile.gamesPlayed")}
            </span>
          </div>
          <ScrollArea className="pr-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGames.map(game => {
                const gameId = game.game || game.name;
                return (
                  <div
                    key={gameId}
                    className="group flex items-center gap-3 rounded-lg border bg-card/50 p-3 backdrop-blur transition-all hover:bg-accent/50"
                  >
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                      <img
                        src={gameImages[gameId]}
                        alt={gameId}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">{gameId}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {game.playTime !== undefined
                            ? game.playTime < 120
                              ? `1 ${t("library.minute")}`
                              : game.playTime < 3600
                                ? `${Math.floor(game.playTime / 60)} ${t("library.minutes")}`
                                : game.playTime < 7200
                                  ? `1 ${t("library.hour")}`
                                  : `${Math.floor(game.playTime / 3600)} ${t("library.hours")}`
                            : t("library.neverPlayed")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Download History */}
        <div className="mt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {t("profile.downloadHistory") || "Download History"}
            </h2>
          </div>
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {downloadHistory.length > 0 ? (
                downloadHistory.map((item, index) => (
                  <div
                    key={`${item.game}-${index}`}
                    className="flex items-center gap-3 rounded-lg border bg-card/50 p-3 backdrop-blur transition-all hover:bg-accent/50"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <FileDown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-foreground">
                        {item.game}
                      </h3>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(item.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Archive className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium">No download history yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Your game download history will appear here
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default Profile;
