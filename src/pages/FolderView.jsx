import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Heart, Gamepad2, Gift, FolderUp, Pencil } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getFolderByName,
  deleteFolder,
  removeGameFromFolder,
  updateFolderName,
  loadFolders,
} from "@/lib/folderManager";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FolderView = () => {
  const { folderName } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [folderGames, setFolderGames] = useState([]);
  // Folder-specific favorites
  const [favorites, setFavorites] = useState([]);
  const lastFolderNameRef = React.useRef(folderName);
  const lastFolderGamesRef = React.useRef([]);
  // Dialog states
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameError, setRenameError] = useState("");

  // Keep the last valid folderName and games for smooth transition
  React.useEffect(() => {
    if (folderName) lastFolderNameRef.current = folderName;
  }, [folderName]);
  React.useEffect(() => {
    if (folderGames && folderGames.length > 0) lastFolderGamesRef.current = folderGames;
  }, [folderGames]);

  useEffect(() => {
    // Load folder data using the folderManager library
    const folder = getFolderByName(decodeURIComponent(folderName));
    if (folder && folder.items) {
      setFolderGames(folder.items);
    }

    // Load folder-specific favorites
    const favoritesObj = JSON.parse(localStorage.getItem("folder-favorites") || "{}");
    const folderKey = decodeURIComponent(folderName);
    setFavorites(favoritesObj[folderKey] || []);
  }, [folderName]);

  // Sort games to show favorites at the top
  useEffect(() => {
    // Only resort if we have games and either favorites changed or folder changed
    if (folderGames.length > 0) {
      // Get the original folder data to maintain original order for non-favorites
      const folder = getFolderByName(decodeURIComponent(folderName));
      const originalItems = folder?.items || [];

      // Create a map of original positions
      const originalPositions = {};
      originalItems.forEach((game, index) => {
        const gameId = game.game || game.name;
        originalPositions[gameId] = index;
      });

      const sortedGames = [...folderGames].sort((a, b) => {
        const aId = a.game || a.name;
        const bId = b.game || b.name;
        const aIsFav = favorites.includes(aId);
        const bIsFav = favorites.includes(bId);

        // If both are favorites or both are not favorites, use original order
        if (aIsFav === bIsFav) {
          return originalPositions[aId] - originalPositions[bId];
        }

        // Otherwise, favorites go first
        return aIsFav ? -1 : 1;
      });

      setFolderGames(sortedGames);
    }
  }, [favorites, folderName]);

  // Folder-specific favorite toggle (multiple favorites per folder, pinned to top)
  const toggleFavorite = gameId => {
    setFavorites(prev => {
      const folderKey = decodeURIComponent(folderName);
      const favoritesObj = JSON.parse(localStorage.getItem("folder-favorites") || "{}");
      const prevFavs = favoritesObj[folderKey] || [];
      let newFavorites;

      if (prevFavs.includes(gameId)) {
        // Unfavorite - remove from favorites
        newFavorites = prevFavs.filter(id => id !== gameId);
      } else {
        // Favorite - add to favorites
        newFavorites = [...prevFavs, gameId];
      }

      favoritesObj[folderKey] = newFavorites;
      localStorage.setItem("folder-favorites", JSON.stringify(favoritesObj));

      // Get the original folder data to maintain original order
      const folder = getFolderByName(decodeURIComponent(folderName));
      const originalItems = folder?.items || [];

      // Create a map of original positions
      const originalPositions = {};
      originalItems.forEach((game, index) => {
        const gameId = game.game || game.name;
        originalPositions[gameId] = index;
      });

      // Reorder folderGames so favorites are first, but maintain original order otherwise
      setFolderGames(currGames => {
        return [...currGames].sort((a, b) => {
          const aId = a.game || a.name;
          const bId = b.game || b.name;
          const aIsFav = newFavorites.includes(aId);
          const bIsFav = newFavorites.includes(bId);

          // If both are favorites or both are not favorites, use original order
          if (aIsFav === bIsFav) {
            return originalPositions[aId] - originalPositions[bId];
          }

          // Otherwise, favorites go first
          return aIsFav ? -1 : 1;
        });
      });

      return newFavorites;
    });
  };

  // Handle folder deletion with cleanup of favorites
  const handleDeleteFolder = () => {
    const folderKey = decodeURIComponent(folderName);

    // First clean up favorites for this folder
    const favoritesObj = JSON.parse(localStorage.getItem("folder-favorites") || "{}");
    if (favoritesObj[folderKey]) {
      delete favoritesObj[folderKey];
      localStorage.setItem("folder-favorites", JSON.stringify(favoritesObj));
    }

    // Move games back to main library if needed
    const folders = loadFolders();
    const folder = folders.find(f => f.game === folderKey);
    if (folder && folder.items && folder.items.length > 0) {
      // Add all games back to main list
      const mainGames = JSON.parse(localStorage.getItem("games") || "[]");
      const updatedGames = [...mainGames, ...folder.items];
      localStorage.setItem("games", JSON.stringify(updatedGames));
    }

    // Then delete the folder
    deleteFolder(folderKey);
    navigate("/library");
  };

  const handlePlayGame = game => {
    const gameId = game.game || game.name;
    console.log("Play game:", gameId);
    navigate("/gamescreen", {
      state: {
        gameData: game,
      },
    });
  };

  // Handle removing a game from the folder
  const handleRemoveFromFolder = gameId => {
    const folderKey = decodeURIComponent(folderName);

    // Remove from favorites if it was favorited
    if (favorites.includes(gameId)) {
      const favoritesObj = JSON.parse(localStorage.getItem("folder-favorites") || "{}");
      if (favoritesObj[folderKey]) {
        favoritesObj[folderKey] = favoritesObj[folderKey].filter(id => id !== gameId);
        localStorage.setItem("folder-favorites", JSON.stringify(favoritesObj));
        setFavorites(prev => prev.filter(id => id !== gameId));
      }
    }

    // Remove from folder
    removeGameFromFolder(gameId, folderKey);

    // Update UI
    setFolderGames(prev => prev.filter(game => (game.game || game.name) !== gameId));
  };

  const GameCard = ({ game }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageData, setImageData] = useState("");
    const isFavorite = favorites.includes(game.game || game.name);

    useEffect(() => {
      // Try to load cached image from localStorage
      const localStorageKey = `game-image-${game.game || game.name}`;
      const cachedImage = localStorage.getItem(localStorageKey);
      if (cachedImage) {
        setImageData(cachedImage);
      } else {
        // Use a default image or placeholder
        setImageData("/placeholder-game.jpg");
      }
    }, [game]);

    return (
      <Card
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-all duration-200",
          "hover:-translate-y-1 hover:shadow-xl",
          "cursor-pointer"
        )}
        onClick={e => {
          // Only navigate if not clicking on action buttons
          if (e.target.closest("button")) return;
          handlePlayGame(game);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={imageData}
              alt={game.game}
              className="h-full w-full border-b border-border object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {typeof game.launchCount === "undefined" && !game.isCustom && (
              <span className="pointer-events-none absolute left-2 top-2 z-20 select-none rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">
                {t("library.newBadge")}
              </span>
            )}
            {/* Floating action bar for buttons */}
            <div className="absolute bottom-3 right-3 z-10 flex gap-2 rounded-lg bg-black/60 p-2 opacity-90 shadow-md transition-opacity hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                title={t("library.removeFromFolder")}
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  handleRemoveFromFolder(game.game || game.name);
                }}
              >
                <FolderUp className="h-6 w-6 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                title={
                  isFavorite ? t("library.removeFavorite") : t("library.addFavorite")
                }
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  toggleFavorite(game.game || game.name);
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
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 p-4 pt-3">
          <div className="flex w-full items-center gap-2">
            <h3 className="flex-1 truncate text-lg font-semibold text-foreground">
              {game.game}
            </h3>
            {game.online && <Gamepad2 className="h-4 w-4 text-muted-foreground" />}
            {game.dlc && <Gift className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="line-clamp-2 w-full text-sm text-muted-foreground">
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
              <span className="font-medium md:text-xs">{t("library.neverPlayed")}</span>
            )}
          </p>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/library")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>

        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
          {t("library.deleteFolder")}
        </Button>
      </div>

      <div className="mb-6 flex items-center">
        <h1 className="mr-2 text-2xl font-bold">
          {decodeURIComponent(lastFolderNameRef.current || "")}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            setNewFolderName(decodeURIComponent(lastFolderNameRef.current || ""));
            setRenameError("");
            setShowRenameDialog(true);
          }}
        >
          <Pencil className="mb-2 h-4 w-4" />
        </Button>
      </div>

      {/* Rename Folder Dialog */}
      <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("library.renameFolderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("library.renameFolderDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={e => {
                setNewFolderName(e.target.value);
                setRenameError("");
              }}
              placeholder={t("library.folderNamePlaceholder")}
              className="w-full"
              autoFocus
            />
            {renameError && (
              <p className="text-destructive mt-2 text-sm">{renameError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();

                // Validate input
                if (!newFolderName.trim()) {
                  setRenameError(t("library.folderNameRequired"));
                  return;
                }

                const oldFolderName = decodeURIComponent(folderName);

                // Check if a folder with this name already exists
                const folders = loadFolders();
                const folderExists = folders.some(
                  folder => folder.game === newFolderName && folder.game !== oldFolderName
                );

                if (folderExists) {
                  setRenameError(t("library.folderNameExists"));
                  return;
                }

                try {
                  // Update folder name
                  updateFolderName(oldFolderName, newFolderName);

                  // Navigate to the new folder URL
                  navigate(`/folderview/${encodeURIComponent(newFolderName)}`);

                  // Close dialog
                  setShowRenameDialog(false);
                } catch (error) {
                  setRenameError(error.message || t("library.folderRenameError"));
                }
              }}
            >
              {t("common.save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          className="border-border bg-background"
          onClick={e => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("library.confirmRemoveFolderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("library.confirmRemoveFolderDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={e => {
                e.stopPropagation();
                setShowDeleteDialog(false);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={e => {
                e.stopPropagation();
                handleDeleteFolder();
                setShowDeleteDialog(false);
              }}
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(() => {
        const gamesToShow =
          folderGames && folderGames.length > 0
            ? folderGames
            : lastFolderGamesRef.current && lastFolderGamesRef.current.length > 0
              ? lastFolderGamesRef.current
              : [];
        return gamesToShow.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <div className="text-lg font-medium text-foreground">
              {t("library.emptyFolder")}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("library.dragGamesToFolder")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gamesToShow.map(game => (
              <GameCard key={game.game || game.name} game={game} />
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default FolderView;
