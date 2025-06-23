import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";
import {
  Download,
  Server,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Trash,
  StopCircle,
  RefreshCw,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getUserInfo,
  getAllDownloads,
  controlWebDownload,
  getApiKey,
} from "@/services/torboxService";

// Utility function to manage stored game names
const manageStoredGameNames = () => {
  try {
    // Simply retrieve the stored game names without expiration logic
    const torboxNames = JSON.parse(localStorage.getItem("torboxGameNames") || "{}");
    return torboxNames;
  } catch (err) {
    console.error("Error managing stored game names:", err);
    return {};
  }
};

const TorboxDownloads = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();

  // State for TorBox downloads
  const [torboxDownloads, setTorboxDownloads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Remove serverStats state, use only userInfo for real data
  const [userInfo, setUserInfo] = useState(null);
  const [userInfoLoading, setUserInfoLoading] = useState(true);
  const [userInfoError, setUserInfoError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmStop, setConfirmStop] = useState(null);

  // Polling interval reference
  const pollingRef = useRef(null);

  // Fetch TorBox downloads
  const fetchTorboxDownloads = async () => {
    if (!settings?.torboxApiKey) {
      setError("TorBox API key not found in settings");
      setIsLoading(false);
      return;
    }

    try {
      // Use the getAllDownloads service function
      const downloads = await getAllDownloads(settings.torboxApiKey);
      console.log("[TorboxDownloads] Downloads fetched:", downloads);
      setTorboxDownloads(downloads || []);
      setError(null);
    } catch (err) {
      console.error("[TorboxDownloads] Error fetching downloads:", err);
      setError("Failed to fetch TorBox downloads");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove fetchServerStats, only fetch userInfo

  // Fetch user information
  const fetchUserInfo = async () => {
    if (!settings?.torboxApiKey) {
      setUserInfoError("No TorBox API key in settings");
      setUserInfoLoading(false);
      setUserInfo(null);
      return;
    }

    // Only show loading state on initial load, not on refresh
    if (userInfo === null) {
      setUserInfoLoading(true);
    }
    setUserInfoError(null);
    try {
      const info = await getUserInfo(settings.torboxApiKey);
      console.debug("[TorboxDownloads] User info API response:", info);
      if (!info || typeof info !== "object" || !info.email) {
        setUserInfoError("Unexpected user info response");
        setUserInfo(null);
      } else {
        setUserInfo(info);
      }
    } catch (err) {
      setUserInfoError(err?.message || "Failed to fetch user info");
      setUserInfo(null);
      console.error("[TorboxDownloads] Error fetching user info:", err);
    } finally {
      setUserInfoLoading(false);
    }
  };

  // Setup polling
  useEffect(() => {
    // Initial fetch
    fetchTorboxDownloads();
    fetchUserInfo();

    // Setup polling interval (every 10 seconds for downloads, 60 seconds for user info)
    const downloadInterval = setInterval(() => {
      fetchTorboxDownloads();
    }, 10000);

    // Separate interval for user info (every 60 seconds)
    const userInfoInterval = setInterval(() => {
      fetchUserInfo();
    }, 60000);

    // Cleanup interval on unmount
    return () => {
      clearInterval(downloadInterval);
      clearInterval(userInfoInterval);
    };
  }, [settings.torboxApiKey]);

  // Handle stop download
  const handleStopDownload = download => {
    setConfirmStop(download);
  };

  // Handle delete download
  const handleDeleteDownload = download => {
    setConfirmDelete(download);
  };

  const deleteDownload = async download => {
    if (!download || !download.id) {
      toast.error(t("torbox.error_invalid_download"));
      return;
    }

    try {
      const apiKey = getApiKey(settings);
      if (!apiKey) {
        toast.error(t("torbox.error_no_api_key"));
        return;
      }

      await controlWebDownload(apiKey, {
        webdl_id: download.id,
        operation: "delete",
      });

      // Update the downloads list after successful deletion
      fetchDownloads();

      toast({
        title: t("torbox.download_deleted"),
        description: t("torbox.download_deleted_desc", {
          name: download?.name || download?.files?.[0]?.short_name || t("common.file"),
        }),
      });
    } catch (error) {
      console.error("[TorboxDownloads] Error deleting download:", error);
      toast.error(t("torbox.error_deleting_download"));
    }
  };

  // Handle download to PC
  const handleDownloadToPC = async download => {
    if (!download || !download.id) {
      toast.error(t("torbox.error_invalid_download"));
      return;
    }

    try {
      // First, try to get stored download data from local storage
      const torboxData = manageStoredGameNames();
      const storedData = torboxData[download.id] || null;

      if (!storedData || !storedData.gameData) {
        // If no stored data, try to download directly from the current download
        if (download.files && download.files.length > 0 && download.files[0].url) {
          // Get a direct file URL from the download
          const fileUrl = download.files[0].url;
          const fileName =
            storedData?.name ||
            download.name ||
            download.files[0].short_name ||
            "download";

          toast.info(t("torbox.starting_download_to_pc", { name: fileName }));

          try {
            // Use electron to download the file
            await window.electron.downloadFile(
              fileUrl,
              fileName,
              false, // online
              false, // dlc
              false, // update
              "", // version
              storedData?.imgUrl || null, // imgID
              download.size ? formatBytes(download.size) : "", // size
              0 // dir (default)
            );

            toast.success(t("torbox.download_started", { name: fileName }));
          } catch (error) {
            console.error("[TorboxDownloads] Error starting download:", error);
            toast.error(t("torbox.error_starting_download"));
          }
          return;
        }

        toast.error(t("torbox.error_no_download_data"));
        return;
      }

      // We have stored data, use it to process the download like in Download.jsx
      const { gameData, provider, originalUrl } = storedData;

      toast.info(t("torbox.processing_download", { name: gameData.game }));

      // Get the API key
      const apiKey = getApiKey(settings);
      if (!apiKey) {
        toast.error(t("torbox.error_no_api_key"));
        return;
      }

      // Get a fresh direct download link
      const result = await controlWebDownload(apiKey, {
        webdl_id: download.id,
        operation: "download",
      });

      if (!result || !result.data || !result.data.url) {
        throw new Error("Failed to get direct download URL");
      }

      const directUrl = result.data.url;

      // Sanitize game name
      const sanitizedGameName = gameData.game.replace(/[<>:"/\\|?*]/g, "");

      toast.success(t("torbox.download_ready"));

      // Start the download using electron
      await window.electron.downloadFile(
        directUrl,
        sanitizedGameName,
        gameData.online || false,
        gameData.dlc || false,
        false, // update
        gameData.version || "",
        gameData.imgID || null,
        gameData.size || "",
        0 // dir (default)
      );

      toast.success(t("torbox.download_started", { name: gameData.game }));
    } catch (error) {
      console.error("[TorboxDownloads] Error downloading to PC:", error);
      toast.error(t("torbox.error_downloading_to_pc"));
    }
  };

  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 mt-10 text-3xl font-bold text-primary">{t("torbox.title")}</h1>

      {/* Server Stats */}
      <Card className="mb-6 border-border/30">
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <Server className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold">{t("torbox.account")}</h3>
                {userInfoLoading && !userInfo ? (
                  <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    {t("torbox.loading_account")}
                  </div>
                ) : userInfoError ? (
                  <div className="text-destructive mt-2">{userInfoError}</div>
                ) : (
                  userInfo && (
                    <div className="mt-2 space-y-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">
                          {t("common.email")}
                        </span>
                        <span className="font-medium">{userInfo.email}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">
                            {t("torbox.plan")}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={userInfo.plan > 0 ? "default" : "outline"}
                              className="mt-0.5"
                            >
                              {userInfo.plan === 0
                                ? t("torbox.plan_free")
                                : userInfo.plan === 1
                                  ? t("torbox.plan_essential")
                                  : userInfo.plan === 2
                                    ? t("torbox.plan_standard")
                                    : userInfo.plan === 3
                                      ? t("torbox.plan_pro")
                                      : "Unknown"}
                            </Badge>
                            {userInfo.premium_expires_at && userInfo.plan > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {t("torbox.expires", {
                                  date: new Date(
                                    userInfo.premium_expires_at
                                  ).toLocaleDateString(),
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">
                            {t("torbox.downloads")}
                          </span>
                          <span className="font-medium">
                            {t("torbox.downloads_count", {
                              count: userInfo.total_downloaded,
                            })}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">
                            {t("torbox.data")}
                          </span>
                          <span className="font-medium">
                            {t("torbox.data_size", {
                              size: (userInfo.total_bytes_downloaded / 1024 ** 3).toFixed(
                                2
                              ),
                            })}
                          </span>
                        </div>

                        {userInfo.cooldown_until &&
                          new Date(userInfo.cooldown_until) > new Date() && (
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">
                                {t("torbox.cooldown")}
                              </span>
                              <span className="font-medium text-amber-500">
                                {new Date(userInfo.cooldown_until).toLocaleString()}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                fetchTorboxDownloads();
                fetchUserInfo();
                toast({
                  title: t("common.refreshed"),
                  description: t("torbox.data_refreshed"),
                });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for download categories */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">{t("torbox.all_downloads")}</TabsTrigger>
          <TabsTrigger value="active">{t("torbox.active")}</TabsTrigger>
          <TabsTrigger value="completed">{t("torbox.completed")}</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">{t("torbox.loading_downloads")}</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="text-destructive mb-2 h-12 w-12" />
            <h3 className="mb-1 text-xl font-semibold">{t("common.error")}</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchTorboxDownloads}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <>
            <TabsContent value="all">
              {torboxDownloads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mx-auto w-fit rounded-full bg-primary/5 p-6">
                    <Coffee className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="mb-1 mt-2 text-xl font-semibold">
                    {t("torbox.no_downloads")}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {t("torbox.no_downloads_desc")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {torboxDownloads.map((download, idx) => (
                    <TorboxDownloadCard
                      key={download.id || `torbox-${idx}`}
                      download={download}
                      onStop={() => handleStopDownload(download)}
                      onDelete={() => handleDeleteDownload(download)}
                      onDownloadToPC={() => handleDownloadToPC(download)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active">
              {torboxDownloads.filter(
                d =>
                  d.download_state?.toLowerCase() !== "completed" &&
                  d.download_state?.toLowerCase() !== "error"
              ).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mx-auto w-fit rounded-full bg-primary/5 p-6">
                    <Coffee className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="mb-1 mt-2 text-xl font-semibold">
                    {t("torbox.no_active_downloads")}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {t("torbox.no_active_downloads_desc")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {torboxDownloads
                    .filter(
                      d =>
                        d.download_state?.toLowerCase() !== "completed" &&
                        d.download_state?.toLowerCase() !== "error"
                    )
                    .map((download, idx) => (
                      <TorboxDownloadCard
                        key={download.id || `torbox-active-${idx}`}
                        download={download}
                        onStop={() => handleStopDownload(download)}
                        onDelete={() => handleDeleteDownload(download)}
                        onDownloadToPC={() => handleDownloadToPC(download)}
                      />
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {torboxDownloads.filter(
                d => d.download_state?.toLowerCase() === "completed"
              ).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mx-auto w-fit rounded-full bg-primary/5 p-6">
                    <Coffee className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="mb-1 mt-2 text-xl font-semibold">
                    {t("torbox.no_completed_downloads")}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {t("torbox.no_completed_downloads_desc")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {torboxDownloads
                    .filter(d => d.download_state?.toLowerCase() === "completed")
                    .map((download, idx) => (
                      <TorboxDownloadCard
                        key={download.id || `torbox-completed-${idx}`}
                        download={download}
                        onDelete={() => handleDeleteDownload(download)}
                        onDownloadToPC={() => handleDownloadToPC(download)}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!confirmStop} onOpenChange={() => setConfirmStop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("torbox.stop_download")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("torbox.stop_download_confirm", {
                name: confirmStop?.name || confirmStop?.filename || t("torbox.this_file"),
              })}
              {t("common.action_cannot_be_undone")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // In a real implementation, this would call an API to stop the download
                toast({
                  title: t("torbox.download_stopped"),
                  description: t("torbox.download_stopped_desc", {
                    name: confirmStop?.name || confirmStop?.filename || t("common.file"),
                  }),
                });
                setConfirmStop(null);
              }}
            >
              Stop Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("torbox.delete_download")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("torbox.delete_download_confirm", {
                name:
                  confirmDelete?.name || confirmDelete?.filename || t("torbox.this_file"),
              })}
              {t("common.action_cannot_be_undone")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                deleteDownload(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// TorBox Download Card Component
const TorboxDownloadCard = ({ download, onStop, onDelete, onDownloadToPC }) => {
  const { t } = useLanguage();
  const [storedName, setStoredName] = useState(null);

  // Try to get a better name from local storage
  useEffect(() => {
    try {
      // Get stored game names with automatic cleanup of old entries
      const torboxNames = manageStoredGameNames();

      // Look for a match based on download ID or URL
      if (download) {
        // First check if we have a direct match by ID
        if (download.id && torboxNames[download.id]) {
          setStoredName(torboxNames[download.id].name);
          return;
        }

        // Check if we have a match by URL
        if (download.url && torboxNames[download.url]) {
          setStoredName(torboxNames[download.url].name);
          return;
        }

        // Check if we have a match in any of the files
        if (download.files && Array.isArray(download.files)) {
          for (const file of download.files) {
            if (file.url && torboxNames[file.url]) {
              setStoredName(torboxNames[file.url].name);
              return;
            }
          }
        }

        // If we still don't have a match, try to match by original URL if available
        if (download.original_url && torboxNames[download.original_url]) {
          setStoredName(torboxNames[download.original_url].name);
          return;
        }
      }
    } catch (err) {
      console.error("Error retrieving stored game name:", err);
    }
  }, [download]);

  // Fallbacks for missing fields
  const name =
    storedName ||
    download?.name ||
    download?.files?.[0]?.short_name ||
    t("common.unknown");
  // If progress is a float (0-1), convert to percent
  let progress = 0;
  if (typeof download?.progress === "number") {
    progress =
      download.progress > 1 ? download.progress : Math.round(download.progress * 100);
  } else if (typeof download?.percent === "number") {
    progress = download.percent;
  }
  const status = download?.download_state || download?.status || download?.state || "";
  const size = download?.size ? formatBytes(download.size) : null;
  const downloaded = download?.downloaded || null;
  // Consider both completed and cached as completed states
  const isCompleted =
    status.toLowerCase() === "completed" || status.toLowerCase() === "cached";

  // Format the file size for display
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  // Get status badge color
  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "cached":
        return "bg-success text-success-foreground";
      case "downloading":
        return "bg-primary text-primary-foreground";
      case "paused":
        return "bg-warning text-warning-foreground";
      case "error":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Card className="overflow-hidden border border-border/30 bg-background/50">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn("capitalize", getStatusColor(status))}>
              {status || t("common.unknown")}
            </Badge>
            {isCompleted && (
              <Badge variant="outline" className="border-primary text-primary">
                {t("torbox.ready_to_download")}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isCompleted && onStop && (
                <DropdownMenuItem onClick={onStop}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  {t("torbox.stop_download")}
                </DropdownMenuItem>
              )}
              {isCompleted && onDownloadToPC && (
                <DropdownMenuItem onClick={onDownloadToPC}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("torbox.download_to_pc")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="mb-2 truncate text-lg font-medium">{name}</h3>

        <Progress
          value={progress}
          className="mb-2 h-2"
          color={isCompleted ? "bg-success" : undefined}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {downloaded && size ? `${downloaded} / ${size}` : size ? `${size}` : ""}
          </span>
          <span>{progress ? `${progress}%` : null}</span>
        </div>

        {isCompleted && onDownloadToPC && (
          <Button className="mt-3 w-full" size="sm" onClick={onDownloadToPC}>
            <Download className="mr-2 h-4 w-4" />
            {t("torbox.download_to_pc")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TorboxDownloads;
