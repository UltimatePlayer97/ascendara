import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FolderSync,
  FolderOpen,
  RotateCcw,
  Save,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Card, CardContent } from "./ui/card";

const GamesBackupDialog = ({ game, open, onOpenChange }) => {
  const [activeScreen, setActiveScreen] = useState("options"); // options, backup, restore, restoreConfirm
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFailed, setBackupFailed] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [backupDetails, setBackupDetails] = useState({ error: null });
  const [restoreDetails, setRestoreDetails] = useState({ error: null });
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const { t } = useLanguage();
  const { settings } = useSettings();

  useEffect(() => {
    if (open) {
      // Reset states when dialog opens
      setActiveScreen("options");
      setBackupFailed(false);
      setRestoreFailed(false);
      setBackupSuccess(false);
      setRestoreSuccess(false);
    }
  }, [open]);

  const handleToggleAutoBackup = async enabled => {
    try {
      const gameBackups = game.backups ?? false;
      const newBackupState = !gameBackups;

      if (newBackupState) {
        await window.electron.enableGameAutoBackups(game.game, game.isCustom);
      } else {
        await window.electron.disableGameAutoBackups(game.game, game.isCustom);
      }

      setAutoBackupEnabled(newBackupState);

      toast.success(
        newBackupState
          ? t("library.backups.autoBackupEnabled")
          : t("library.backups.autoBackupDisabled"),
        {
          description: newBackupState
            ? t("library.backups.autoBackupEnabledDesc", { game: game.game || game.name })
            : t("library.backups.autoBackupDisabledDesc", {
                game: game.game || game.name,
              }),
        }
      );
    } catch (error) {
      console.error("Error toggling auto backup:", error);
      toast.error(t("library.backups.toggleFailed"));
    }
  };

  const handleBackupGame = async () => {
    setActiveScreen("backup");
    setIsBackingUp(true);
    setBackupFailed(false);
    setBackupSuccess(false);
    setBackupDetails({ error: null });

    try {
      // Call the electron API to backup the game
      const result = await window.electron.ludusavi("backup", game.game || game.name);

      if (!result?.success) {
        setBackupFailed(true);
        if (result?.error) {
          setBackupDetails({ error: result.error });
        }
        throw new Error(result?.error || "Backup failed");
      }

      setBackupSuccess(true);

      toast.success(t("library.backups.backupSuccess"), {
        description: t("library.backups.backupSuccessDesc", {
          game: game.game || game.name,
        }),
      });
    } catch (error) {
      console.error("Backup failed:", error);
      setBackupFailed(true);
      toast.error(t("library.backups.backupFailed"));
    } finally {
      setIsBackingUp(false);
    }
  };

  const showRestoreConfirmation = () => {
    setActiveScreen("restoreConfirm");
  };

  const handleRestoreBackup = async () => {
    setActiveScreen("restore");
    setIsRestoring(true);
    setRestoreFailed(false);
    setRestoreSuccess(false);
    setRestoreDetails({ error: null });

    try {
      // Call the electron API to restore the latest backup
      const result = await window.electron.ludusavi("restore", game.game || game.name);

      if (!result?.success) {
        setRestoreFailed(true);
        if (result?.error) {
          setRestoreDetails({ error: result.error });
        }
        throw new Error(result?.error || "Restore failed");
      }

      setRestoreSuccess(true);

      toast.success(t("library.backups.restoreSuccess"), {
        description: t("library.backups.restoreSuccessDesc", {
          game: game.game || game.name,
        }),
      });
    } catch (error) {
      console.error("Restore failed:", error);
      setRestoreFailed(true);
      toast.error(t("library.backups.restoreFailed"));
    } finally {
      setIsRestoring(false);
    }
  };

  const openBackupFolder = () => {
    window.electron.openGameDirectory("backupDir");
  };

  const renderOptionsScreen = () => (
    <div className="space-y-6 py-2">
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-primary/20 transition-colors hover:border-primary/40">
          <CardContent className="p-4">
            <Button
              className="flex w-full items-center justify-between bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary/90"
              onClick={handleBackupGame}
            >
              <div className="flex items-center gap-2 text-secondary">
                <Save className="h-5 w-5" />
                <span>
                  {t("library.backups.backupNow", { game: game.game || game.name })}
                </span>
              </div>
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-muted/60 transition-colors hover:border-muted">
            <CardContent className="p-4">
              <Button
                className="flex h-full w-full flex-col items-center justify-center gap-2 py-4"
                variant="outline"
                onClick={showRestoreConfirmation}
                disabled={!settings.ludusavi.enabled}
              >
                <RotateCcw className="h-5 w-5" />
                <span className="text-sm">{t("library.backups.restoreLatest")}</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-muted/60 transition-colors hover:border-muted">
            <CardContent className="p-4">
              <Button
                className="flex h-full w-full flex-col items-center justify-center gap-2 py-4"
                variant="outline"
                onClick={openBackupFolder}
              >
                <FolderOpen className="h-5 w-5" />
                <span className="text-sm">{t("library.backups.openBackupFolder")}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-2" />

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-1">
              <Label htmlFor="autoBackup" className="text-base font-medium">
                {t("library.backups.autoBackupOnGameClose")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("library.backups.autoBackupDesc")}
              </p>
            </div>
            <Switch
              id="autoBackup"
              checked={autoBackupEnabled}
              onCheckedChange={handleToggleAutoBackup}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRestoreConfirmScreen = () => (
    <div className="space-y-4 py-2">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
          <div className="rounded-full bg-amber-500/10 p-3">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <div className="text-center">
            <h3 className="mb-2 text-lg font-medium text-amber-500">
              {t("library.backups.restoreWarningTitle")}
            </h3>
            <p className="mb-2 text-sm">
              {t("library.backups.restoreWarningDesc", { game: game.game || game.name })}
            </p>
            <p className="mb-2 text-sm font-medium">
              {t("library.backups.restoreWarningOverwrite")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("library.backups.restoreWarningGameClosed")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBackupScreen = () => (
    <div className="space-y-4 py-2">
      {isBackingUp && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-medium">
                {t("library.backups.backingUpDescription", {
                  game: game.game || game.name,
                })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("library.backups.waitingBackup")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isBackingUp && backupSuccess && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="rounded-full bg-green-500/10 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-medium text-green-500">
                {t("library.backups.backupSuccess")}
              </h3>
              <p className="text-sm">
                {t("library.backups.backupSuccessDesc", { game: game.game || game.name })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isBackingUp && backupFailed && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="bg-destructive/10 rounded-full p-3">
              <AlertTriangle className="text-destructive h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-destructive mb-1 text-lg font-medium">
                {t("library.backups.backupFailed")}
              </h3>
              {backupDetails.error && (
                <ScrollArea className="border-destructive/20 mt-2 h-[100px] w-full rounded-md border p-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{backupDetails.error}</span>
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRestoreScreen = () => (
    <div className="space-y-4 py-2">
      {isRestoring && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-medium">
                {t("library.backups.restoringDescription", {
                  game: game.game || game.name,
                })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("library.backups.waitingRestore")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isRestoring && restoreSuccess && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="rounded-full bg-green-500/10 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 text-lg font-medium text-green-500">
                {t("library.backups.restoreSuccess")}
              </h3>
              <p className="text-sm">
                {t("library.backups.restoreSuccessDesc", {
                  game: game.game || game.name,
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isRestoring && restoreFailed && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
            <div className="bg-destructive/10 rounded-full p-3">
              <AlertTriangle className="text-destructive h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-destructive mb-1 text-lg font-medium">
                {t("library.backups.restoreFailed")}
              </h3>
              {restoreDetails.error && (
                <ScrollArea className="border-destructive/20 mt-2 h-[100px] w-full rounded-md border p-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{restoreDetails.error}</span>
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeScreen) {
      case "backup":
        return renderBackupScreen();
      case "restore":
        return renderRestoreScreen();
      case "restoreConfirm":
        return renderRestoreConfirmScreen();
      case "options":
      default:
        return renderOptionsScreen();
    }
  };

  const renderFooterButtons = () => {
    if (activeScreen === "options") {
      return (
        <Button
          variant="outline"
          className="text-primary"
          onClick={() => onOpenChange(false)}
        >
          {t("common.close")}
        </Button>
      );
    }

    if (activeScreen === "restoreConfirm") {
      return (
        <>
          <Button
            className="bg-amber-500 text-white hover:bg-amber-600"
            onClick={handleRestoreBackup}
          >
            {t("library.backups.restoreButton")}
          </Button>
          <Button
            variant="outline"
            className="text-primary"
            onClick={() => setActiveScreen("options")}
          >
            {t("common.cancel")}
          </Button>
        </>
      );
    }

    if (activeScreen === "backup") {
      return (
        <>
          {backupFailed && !isBackingUp && (
            <Button
              className="text-primary-foreground bg-primary/90 hover:bg-primary"
              onClick={handleBackupGame}
              disabled={isBackingUp}
            >
              {t("library.backups.tryAgain")}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-primary"
            onClick={() => setActiveScreen("options")}
            disabled={isBackingUp}
          >
            {isBackingUp ? t("common.close") : t("common.back")}
          </Button>
        </>
      );
    }

    if (activeScreen === "restore") {
      return (
        <>
          {restoreFailed && !isRestoring && (
            <Button
              className="text-primary-foreground bg-primary/90 hover:bg-primary"
              onClick={handleRestoreBackup}
              disabled={isRestoring}
            >
              {t("library.backups.tryAgain")}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-primary"
            onClick={() => setActiveScreen("options")}
            disabled={isRestoring}
          >
            {isRestoring ? t("common.close") : t("common.back")}
          </Button>
        </>
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            {activeScreen === "options" ? (
              <div className="flex items-center gap-2">
                <FolderSync className="h-5 w-5 text-primary" />
                {t("library.backups.gameBackupTitle")}
              </div>
            ) : activeScreen === "backup" ? (
              isBackingUp ? (
                t("library.backups.creatingBackup")
              ) : (
                t("library.backups.backupResult")
              )
            ) : activeScreen === "restoreConfirm" ? (
              t("library.backups.confirmRestore")
            ) : isRestoring ? (
              t("library.backups.restoringBackup")
            ) : (
              t("library.backups.restoreResult")
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {renderContent()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>{renderFooterButtons()}</AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default GamesBackupDialog;
