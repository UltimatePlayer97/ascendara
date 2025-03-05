import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import UserSettingsDialog from "@/components/UserSettingsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Camera,
  Trophy,
  Gamepad2,
  Clock,
  ImagePlus,
  Pencil,
  Calendar,
  Check,
  Save,
  X,
  CircleArrowDown,
} from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");

  const [useGoldbergName, setUseGoldbergName] = useState(true);
  const [generalUsername, setGeneralUsername] = useState("");
  const [bannerImage, setBannerImage] = useState(null);
  const [avatarImage, setAvatarImage] = useState(null);
  const [bio, setBio] = useState(localStorage.getItem("profile-bio") || "");
  const [editingBio, setEditingBio] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    totalPlayTime: 0,
    favoriteGames: [],
    level: 1,
    xp: 0,
    nextLevelXp: 100,
    joinDate: "",
    gamesCompleted: 0,
    totalDownloads: 0,
  });
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

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

        // Load profile images
        const savedBanner = localStorage.getItem("profile-banner");
        const savedAvatar = localStorage.getItem("profile-avatar");
        if (savedBanner) setBannerImage(savedBanner);
        if (savedAvatar) setAvatarImage(savedAvatar);

        // Load game stats
        const installedGames = await window.electron.getGames();
        const customGames = await window.electron.getCustomGames();

        const joinDate = await window.electron.timestampTime();
        console.log(joinDate);

        // Filter out games being verified
        const filteredInstalledGames = installedGames.filter(
          game =>
            !game.downloadingData?.verifying &&
            (!game.downloadingData?.verifyError ||
              game.downloadingData.verifyError.length === 0)
        );

        // Combine both types of games
        const allGames = [
          ...filteredInstalledGames.map(game => ({ ...game, isCustom: false })),
          ...(customGames || []).map(game => ({
            name: game.game,
            game: game.game,
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

        const favorites = JSON.parse(localStorage.getItem("game-favorites") || "[]");

        // Calculate total play time from installed games
        const totalPlayTime = allGames.reduce(
          (total, game) => total + (game.playTime || 0),
          0
        );

        // Calculate level based on games and favorites
        const baseXP = allGames.length * 25 + favorites.length * 10;
        const level = Math.max(1, Math.floor(baseXP / 100) + 1);
        const currentXP = baseXP % 100;

        setStats({
          gamesPlayed: allGames.length,
          totalPlayTime: totalPlayTime,
          favoriteGames: favorites,
          level: level,
          xp: currentXP,
          nextLevelXp: 100,
          joinDate: joinDate,
          gamesCompleted: allGames.filter(game => game.playTime > 0).length,
          totalDownloads: allGames.length,
        });
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };

    loadUserProfile();
  }, []);

  const handleImageUpload = async (type, e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = event => {
        const imageData = event.target.result;
        if (type === "banner") {
          setBannerImage(imageData);
          localStorage.setItem("profile-banner", imageData);
          toast.success(t("profile.bannerUpdated"));
        } else {
          setAvatarImage(imageData);
          localStorage.setItem("profile-avatar", imageData);
          toast.success(t("profile.avatarUpdated"));
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(t("profile.imageUploadError"));
    }
  };

  const handleRemoveImage = type => {
    if (type === "banner") {
      setBannerImage(null);
      localStorage.removeItem("profile-banner");
      toast.success(t("profile.bannerRemoved"));
    } else {
      setAvatarImage(null);
      localStorage.removeItem("profile-avatar");
      toast.success(t("profile.avatarRemoved"));
    }
  };

  const saveBio = () => {
    localStorage.setItem("profile-bio", bio);
    setEditingBio(false);
    toast.success(t("profile.bioUpdated"));
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const formatPlayTime = hours => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    if (hours < 10) {
      return `${hours.toFixed(1)} hours`;
    }
    return `${Math.round(hours)} hours`;
  };

  return (
    <div className="container mx-auto space-y-6 p-4">
      {/* Banner Section */}
      <div className="relative mt-6 h-64 w-full overflow-hidden rounded-lg bg-secondary">
        {bannerImage ? (
          <>
            <img
              src={bannerImage}
              alt="Profile Banner"
              className="h-full w-full object-cover"
            />
            <div className="absolute right-4 top-4 flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="bg-background/80 backdrop-blur-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("profile.changeBanner")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="bg-destructive/80 backdrop-blur-sm"
                      onClick={() => handleRemoveImage("banner")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("profile.removeBanner")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <label className="cursor-pointer">
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={e => handleImageUpload("banner", e)}
              />
              <div className="flex flex-col items-center text-muted-foreground">
                <ImagePlus className="mb-2 h-12 w-12" />
                <span className="text-lg">{t("profile.addBanner")}</span>
                <p className="mt-2 max-w-md text-center text-sm">
                  {t("profile.bannerRecommendation")}
                </p>
              </div>
            </label>
          </div>
        )}
        <Input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={e => handleImageUpload("banner", e)}
        />
      </div>

      {/* Profile Info Section */}
      <div className="relative z-10 -mt-24 ml-6">
        <div className="relative inline-block">
          <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-background bg-background shadow-lg">
            {avatarImage ? (
              <>
                <img
                  src={avatarImage}
                  alt="Profile Avatar"
                  className="h-full w-full object-cover"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-1 right-1 bg-background/80 backdrop-blur-sm"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <label className="flex h-full cursor-pointer items-center justify-center bg-secondary">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={avatarInputRef}
                  onChange={e => handleImageUpload("avatar", e)}
                />
                <Camera className="h-12 w-12 text-muted-foreground" />
              </label>
            )}
          </div>
          <Input
            type="file"
            accept="image/*"
            className="hidden"
            ref={avatarInputRef}
            onChange={e => handleImageUpload("avatar", e)}
          />
        </div>

        <div className="mt-4 flex flex-col justify-between md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                {getDisplayUsername()}
              </h1>
              <UserSettingsDialog />
            </div>

            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{t("profile.memberSince", { date: stats.joinDate })}</span>
            </div>
          </div>

          <div className="mt-4 md:mt-0">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("profile.level")}</p>
                <p className="text-2xl font-bold">{stats.level}</p>
              </div>
              <div className="flex w-40 flex-col">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{stats.xp} XP</span>
                  <span>{stats.nextLevelXp} XP</span>
                </div>
                <Progress value={(stats.xp / stats.nextLevelXp) * 100} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bio Section */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{t("profile.about")}</CardTitle>
            {!editingBio && (
              <Button variant="ghost" size="icon" onClick={() => setEditingBio(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingBio ? (
            <div className="space-y-2">
              <Textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder={t("profile.bioPlaceholder")}
                className="min-h-[100px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingBio(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="primary" onClick={saveBio}>
                  <Save className="mr-1 h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{bio || t("profile.noBio")}</p>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="overview">{t("profile.overview")}</TabsTrigger>
          <TabsTrigger value="games">{t("profile.games")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center p-6">
                <Gamepad2 className="mr-4 h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.gamesPlayed")}
                  </p>
                  <p className="text-2xl font-bold">{stats.gamesPlayed}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <Clock className="mr-4 h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("profile.playTime")}</p>
                  <p className="text-2xl font-bold">
                    {formatPlayTime(stats.totalPlayTime)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <Check className="mr-4 h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.gamesCompleted")}
                  </p>
                  <p className="text-2xl font-bold">{stats.gamesCompleted}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-6">
                <CircleArrowDown className="mr-4 h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.totalDownloads")}
                  </p>
                  <p className="text-2xl font-bold">{stats.totalDownloads}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Games Tab */}
        <TabsContent value="games" className="space-y-6">
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.favoriteGames.map((gameId, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold">{gameId}</h3>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
