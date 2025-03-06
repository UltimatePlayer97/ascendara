import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import UsernameDialog from "@/components/UsernameDialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trophy, Clock, Smile, Timer } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

const Profile = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [useGoldbergName, setUseGoldbergName] = useState(true);
  const [generalUsername, setGeneralUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(
    localStorage.getItem("profile-emoji") || "😊"
  );
  const [bio, setBio] = useState(localStorage.getItem("profile-bio") || "");
  const [downloadHistory, setDownloadHistory] = useState([]);
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
    joinDate: "",
    gamesCompleted: 0,
    totalDownloads: 0,
    achievements: [],
    recentActivity: [],
    favoriteGenres: [],
    genreDistribution: {},
  });
  const [gameImages, setGameImages] = useState({});
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

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
        "🎪",
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
    localStorage.setItem("profile-emoji", emoji);
  };

  const getDisplayUsername = () => {
    if (useGoldbergName) {
      return username || "Guest";
    }
    return generalUsername || "Guest";
  };

  useEffect(() => {
    const handleUsernameUpdate = event => {
      const {
        useGoldbergName: newUseGoldberg,
        generalUsername: newGeneralUsername,
        goldbergUsername,
      } = event.detail || {};

      if (newUseGoldberg !== undefined) {
        setUseGoldbergName(newUseGoldberg);
      }

      if (newGeneralUsername !== undefined) {
        setGeneralUsername(newGeneralUsername);
      }

      if (goldbergUsername !== undefined) {
        setUsername(goldbergUsername);
        setNewUsername(goldbergUsername);
      } else {
        window.electron.getLocalCrackUsername().then(newUsername => {
          setUsername(newUsername || "");
          setNewUsername(newUsername || "");
        });
      }
    };

    window.addEventListener("usernameUpdated", handleUsernameUpdate);
    return () => window.removeEventListener("usernameUpdated", handleUsernameUpdate);
  }, []);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // Load usernames
        const savedUsername = await window.electron.getLocalCrackUsername();
        const savedGeneralUsername = localStorage.getItem("general-username");
        const savedUseGoldberg = localStorage.getItem("use-goldberg-name");

        setUsername(savedUsername || "");
        setNewUsername(savedUsername || "");
        setGeneralUsername(savedGeneralUsername || "");
        setUseGoldbergName(
          savedUseGoldberg === null ? true : savedUseGoldberg === "true"
        );

        const installedGames = await window.electron.getGames();
        const customGames = await window.electron.getCustomGames();
        const joinDate = await window.electron.timestampTime();

        // Filter out games that are being verified
        const filteredInstalledGames = installedGames.filter(
          game => !game.downloadingData?.verifying
        );

        // Combine both types of games
        const allGames = [
          ...(filteredInstalledGames || []).map(game => ({
            ...game,
            isCustom: false,
          })),
          ...(customGames || []).map(game => ({
            name: game.game,
            game: game.game,
            version: game.version,
            online: game.online,
            dlc: game.dlc,
            isCustom: true,
            custom: true,
          })),
        ];

        const favorites = JSON.parse(localStorage.getItem("game-favorites") || "[]");

        // Calculate total play time from installed games
        const totalPlayTime = allGames.reduce(
          (total, game) => total + (game.playTime || 0),
          0
        );

        // Calculate level and XP
        const calculateGameXP = game => {
          const playtimeXP = Math.floor((game.playTime || 0) / 60) * 8; // 8 XP per hour played
          const launchXP = Math.min((game.launchCount || 0) * 3, 75); // 3 XP per launch, max 75 XP per game
          const baseGameXP = 50; // One-time XP for adding a game
          return playtimeXP + launchXP + baseGameXP;
        };

        const totalXP = allGames.reduce(
          (total, game) => total + calculateGameXP(game),
          0
        );

        // Level calculation: Each level requires more XP than the last
        const calculateLevel = xp => {
          let level = 1;
          let xpForNextLevel = 150; // Starting XP requirement
          let currentXP = xp;

          while (currentXP >= xpForNextLevel) {
            level++;
            currentXP -= xpForNextLevel;
            xpForNextLevel = Math.floor(xpForNextLevel * 1.5); // Each level requires 50% more XP
          }

          return {
            level,
            currentXP,
            nextLevelXp: xpForNextLevel,
          };
        };

        const levelInfo = calculateLevel(totalXP);

        // Calculate genre distribution
        const genreCount = {};
        allGames.forEach(game => {
          if (game.genre) {
            genreCount[game.genre] = (genreCount[game.genre] || 0) + 1;
          }
        });

        const totalGames = Object.values(genreCount).reduce((a, b) => a + b, 0);
        const sortedGenres = Object.entries(genreCount)
          .sort(([, a], [, b]) => b - a)
          .reduce((acc, [genre, count]) => {
            acc[genre] = {
              count,
              percentage: Math.round((count / totalGames) * 100),
            };
            return acc;
          }, {});

        setStats({
          gamesPlayed: allGames.length,
          totalPlayTime,
          favoriteGames: favorites,
          totalGames: allGames.length,
          level: levelInfo.level,
          xp: totalXP,
          currentXP: levelInfo.currentXP,
          nextLevelXp: levelInfo.nextLevelXp,
          joinDate,
          gamesCompleted: allGames.filter(game => game.playTime > 0).length,
          totalDownloads: allGames.length,
          genreDistribution: sortedGenres,
          achievements: [],
          recentActivity: [],
          favoriteGenres: Object.entries(sortedGenres)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 3)
            .map(([genre]) => genre),
        });

        setGames(allGames);
        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    };

    loadUserProfile();
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

  const renderProfileSection = () => {
    return (
      <div className="relative">
        <div className="flex items-center gap-4 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <div className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-border bg-card text-4xl shadow-lg transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:opacity-90 hover:shadow-xl">
                {selectedEmoji}
                <div className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 shadow-md">
                  <Smile className="text-primary-foreground h-4 w-4" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-3" align="start" sideOffset={5}>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {emojiCategories.map(category => (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {category.title}
                        </h4>
                        <Separator className="flex-1" />
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {category.emojis.map((emoji, index) => (
                          <Button
                            key={`${category.id}-${emoji}-${index}`}
                            variant={selectedEmoji === emoji ? "secondary" : "ghost"}
                            className="h-10 text-xl transition-all duration-200 hover:scale-110 hover:bg-accent"
                            onClick={() => handleEmojiSelect(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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

  const saveBio = async () => {
    setEditingBio(false);
    await saveProfile();
  };

  const saveProfile = async () => {
    try {
      const profileData = {
        username,
        generalUsername,
        useGoldbergName,
        bio,
        statistics: stats,
      };
      await window.electron.saveProfile(profileData);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(t("profile.saveError"));
    }
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
          {t("profile.memberSince", { date: stats.joinDate })}
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
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {t("Level Progress")}
            </CardTitle>
            <CardDescription>{t("profile.levelProgress")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-20"></div>
                <div className="absolute inset-0 animate-[spin_3s_linear_infinite_reverse] rounded-full bg-gradient-to-bl from-pink-500 via-purple-500 to-indigo-500 opacity-10"></div>
                <div className="absolute inset-1 rounded-full bg-background"></div>
                <span className="relative text-3xl font-bold">{stats.level}</span>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">
                      {stats.currentXP.toLocaleString()} XP
                    </span>
                    <span className="text-muted-foreground">
                      {stats.nextLevelXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
                    <div
                      className="flex h-full w-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                      style={{
                        transform: `translateX(-${100 - (stats.currentXP / stats.nextLevelXp) * 100}%)`,
                      }}
                    >
                      <div className="relative h-full w-full">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/5"></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("profile.totalXP", { xp: stats.xp.toLocaleString() })}</span>
                  <span>{t("profile.nextLevel", { level: stats.level + 1 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
          <ScrollArea className="h-[400px] pr-4">
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
                        {game.lastPlayed && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span>
                              {t("profile.lastPlayed")}{" "}
                              {formatDistanceToNow(new Date(game.lastPlayed), {
                                addSuffix: true,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default Profile;
