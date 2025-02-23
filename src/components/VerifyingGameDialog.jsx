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
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { ScrollArea } from "./ui/scroll-area";

const VerifyingGameDialog = ({ game, open, onOpenChange }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLegacyGame, setIsLegacyGame] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [downloadingData, setDownloadingData] = useState({ verifyError: [], verifying: false });
  const { t } = useLanguage();

  const fetchGameData = async () => {
    try {
      const games = await window.electron.getGames();
      const currentGame = games.find(g => g.game === game.game || g.game === game.name);
      if (currentGame?.downloadingData) {
        setDownloadingData(currentGame.downloadingData);
      }
    } catch (error) {
      console.error("Error fetching game data:", error);
    }
  };

  const handleVerifyGame = async () => {
    setIsVerifying(true);
    setIsLegacyGame(false);
    setVerificationFailed(false);
    setDownloadingData(prev => ({ ...prev, verifying: true, verifyError: [] }));
    
    try {
      const result = await window.electron.verifyGame(game.game || game.name);
      
      if (result.error?.includes("ENOENT") && result.error?.includes("filemap.ascendara.json")) {
        setIsLegacyGame(true);
      } else {
        // Wait 2 seconds before checking status
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchGameData();
        
        if (!result.success) {
          setVerificationFailed(true);
          if (result.errors) {
            setDownloadingData(prev => ({ ...prev, verifyError: result.errors }));
          }
          throw new Error(result.error);
        }
        toast.success(t("downloads.verificationSuccess"), {
          description: t("downloads.verificationSuccessDesc"),
        });
      }
    } catch (error) {
      console.error("Verification failed:", error);
      if (error.message?.includes("ENOENT") && error.message?.includes("filemap.ascendara.json")) {
        setIsLegacyGame(true);
      } else {
        setVerificationFailed(true);
        toast.error(t("downloads.verificationFailed"));
      }
    } finally {
      setIsVerifying(false);
      setDownloadingData(prev => ({ ...prev, verifying: false }));
    }
  };

  useEffect(() => {
    if (open) {
      handleVerifyGame();
    }
  }, [open]);

  const hasVerifyError = downloadingData.verifyError && downloadingData.verifyError.length > 0;
  const isVerifyingGame = downloadingData.verifying;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            {isVerifyingGame && <Loader2 className="h-5 w-5 animate-spin" />}
            {isLegacyGame ? t("library.cannotVerifyFiles") : isVerifyingGame ? t("downloads.verifying") : t("library.verifyGameFiles")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {isVerifyingGame && (
              <div className="space-y-4 py-4">
                <p>{t("downloads.verifyingDescription")}</p>
              </div>
            )}
            {!isVerifyingGame && !hasVerifyError && !isVerifying && !isLegacyGame && !verificationFailed && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">
                    {t("downloads.verificationSuccess")}
                  </span>
                </div>
                <p className="text-sm">{t("downloads.verificationSuccessDesc")}</p>
              </div>
            )}
            {!isVerifyingGame && isLegacyGame && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground max-w-md">
                    {t("downloads.actions.legacyGameVerification")}
                  </span>
                </div>
              </div>
            )}
            {!isVerifyingGame && (hasVerifyError || verificationFailed) && !isLegacyGame && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {downloadingData.verifyError.length === 1
                      ? t("downloads.verificationFailed1", { numFailed: downloadingData.verifyError.length })
                      : t("downloads.verificationFailed2", { numFailed: downloadingData.verifyError.length })}
                  </span>
                </div>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="mt-4 space-y-2">
                    {downloadingData.verifyError.map((error, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{error.file}</span>
                        <span className="text-muted-foreground"> - {error.error}</span>
                        {error.expected_size && (
                          <span className="text-muted-foreground"> (Expected size: {error.expected_size} bytes)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-sm">
                  <a
                    className="inline-flex cursor-pointer items-center text-primary hover:underline"
                    onClick={() => {
                      window.electron.openURL(
                        "https://ascendara.app/docs/troubleshooting/common-issues#verification-issues"
                      );
                    }}
                  >
                    {t("common.learnMore")}
                  </a>
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {(hasVerifyError || verificationFailed) && !isVerifyingGame && !isLegacyGame && (
            <Button
              className="text-secondary"
              onClick={handleVerifyGame}
              disabled={isVerifyingGame}
            >
              {t("downloads.verifyAgain")}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-primary"
            onClick={() => onOpenChange(false)}
            disabled={isVerifyingGame}
          >
            {t("common.ok")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VerifyingGameDialog;