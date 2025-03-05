import React, { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Pencil, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

const UserSettingsDialog = () => {
  const [username, setUsername] = useState("");
  const [directory, setDirectory] = useState("");
  const [canCreateFiles, setCanCreateFiles] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [useGoldbergName, setUseGoldbergName] = useState(true);
  const [generalUsername, setGeneralUsername] = useState("");
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const savedUsername = await window.electron.getLocalCrackUsername();
      const savedDirectory = await window.electron.getLocalCrackDirectory();
      const savedGeneralUsername = localStorage.getItem("general-username");
      const savedUseGoldberg = localStorage.getItem("use-goldberg-name");

      if (savedUsername) {
        setUsername(savedUsername);
      } else {
        const systemUsername = "Guest";
        setUsername(systemUsername);
      }

      if (savedGeneralUsername) {
        setGeneralUsername(savedGeneralUsername);
      }

      setUseGoldbergName(savedUseGoldberg === null ? true : savedUseGoldberg === "true");

      if (savedDirectory) {
        setDirectory(savedDirectory);
        const canCreate = await window.electron.canCreateFiles(savedDirectory);
        setCanCreateFiles(canCreate);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    if (!canCreateFiles) {
      toast.error(t("settings.userSettings.directoryError"));
      return;
    }

    try {
      const usernameResult = await window.electron.setLocalCrackUsername(username);
      const directoryResult = await window.electron.setLocalCrackDirectory(directory);

      if (!usernameResult) {
        toast.error(t("settings.userSettings.usernameError"));
        return;
      }
      if (!directoryResult) {
        toast.error(t("settings.userSettings.directoryError"));
        return;
      }

      // Save general username settings
      localStorage.setItem("general-username", generalUsername);
      localStorage.setItem("use-goldberg-name", useGoldbergName.toString());

      // Emit custom event when username is updated
      window.dispatchEvent(
        new CustomEvent("usernameUpdated", {
          detail: { useGoldbergName, generalUsername, goldbergUsername: username },
        })
      );

      toast.success(t("settings.userSettings.saveSuccess"));
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("common.error"));
    }
  };

  const handleDirectorySelect = useCallback(async () => {
    try {
      const newDirectory = await window.electron.openDirectoryDialog();
      if (newDirectory) {
        const canCreate = await window.electron.canCreateFiles(newDirectory);
        setCanCreateFiles(canCreate);

        if (!canCreate) {
          toast.error(t("settings.userSettings.directoryPermissionError"));
          return;
        }

        setDirectory(newDirectory);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
      toast.error(t("common.error"));
    }
  }, [t]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <div className="fixed right-4 top-4 items-center justify-center">
            <X
              className="h-5 w-5 cursor-pointer text-foreground"
              onClick={() => setIsOpen(false)}
            />
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-foreground">
            {t("settings.userSettings.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {t("settings.userSettings.description")}&nbsp;
            <a
              onClick={() =>
                window.electron.openURL(
                  "https://ascendara.app/docs/features/overview#username-customization"
                )
              }
              className="cursor-pointer text-sm text-muted-foreground hover:text-primary"
            >
              {t("common.learnMore")}{" "}
              <ExternalLink className="mb-1 inline-block h-3 w-3" />
            </a>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-muted-foreground" htmlFor="generalUsername">
              {t("settings.userSettings.generalUsername")}
            </Label>
            <Input
              id="generalUsername"
              value={generalUsername}
              className="text-foreground"
              onChange={e => setGeneralUsername(e.target.value)}
              placeholder={t("settings.userSettings.generalUsernamePlaceholder")}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="privacy"
              checked={useGoldbergName}
              onCheckedChange={setUseGoldbergName}
              className="data-[state=checked]:text-primary-foreground data-[state=checked]:bg-primary"
            />
            <Label htmlFor="useGoldbergName" className="text-muted-foreground">
              {t("settings.userSettings.useForGoldberg")}
            </Label>
          </div>

          {!useGoldbergName && (
            <div className="grid gap-2">
              <Label className="text-muted-foreground" htmlFor="username">
                {t("settings.userSettings.goldbergUsername")}
              </Label>
              <Input
                id="username"
                value={username}
                className="text-foreground"
                onChange={e => setUsername(e.target.value)}
                placeholder={t("settings.userSettings.goldbergUsernamePlaceholder")}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label className="text-muted-foreground" htmlFor="directory">
              {t("settings.userSettings.directory")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="directory"
                value={directory}
                onChange={e => setDirectory(e.target.value)}
                placeholder={t("settings.userSettings.directoryDescription")}
                className="flex-1 text-foreground"
              />
              <Button className="text-secondary" onClick={handleDirectorySelect}>
                {t("settings.userSettings.browseDirectory")}
              </Button>
            </div>
            {!canCreateFiles && (
              <p className="text-sm text-muted-foreground">
                {t("settings.userSettings.directoryPermissionError")}
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            className="text-secondary"
            onClick={handleSave}
            disabled={!canCreateFiles}
          >
            {t("settings.userSettings.saveChanges")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UserSettingsDialog;
