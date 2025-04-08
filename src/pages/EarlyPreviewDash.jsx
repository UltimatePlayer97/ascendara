import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FlaskConical,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  FileSearch,
  AlertTriangle,
  FolderOpen,
  Loader,
} from "lucide-react";
import earlyPreviewService from "@/services/earlyPreviewService";
import ReportIssue from "@/components/ReportIssue";

const ExperimentalFeature = ({
  title,
  description,
  status,
  upvotes,
  downvotes,
  onVote,
  isVoting,
}) => (
  <Card className="bg-card/30 p-6 backdrop-blur-sm transition-all hover:bg-card/40">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge
            variant={status === "stable" ? "default" : "warning"}
            className="text-xs"
          >
            {status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp size={14} className="text-green-500" />
            {upvotes}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown size={14} className="text-red-500" />
            {downvotes}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-green-500 hover:bg-green-500/10 hover:text-green-600"
          onClick={() => onVote("up")}
          disabled={isVoting}
        >
          {isVoting ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp size={18} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={() => onVote("down")}
          disabled={isVoting}
        >
          {isVoting ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsDown size={18} />
          )}
        </Button>
      </div>
    </div>
  </Card>
);

const EarlyPreviewDash = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingFeatureId, setVotingFeatureId] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const data = await earlyPreviewService.fetchEarlyChanges();
        setFeatures(data);
      } catch (error) {
        toast.error(t("earlyPreview.fetchError"), {
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    loadFeatures();
  }, [t]);

  const handleVote = async (featureId, type) => {
    setVotingFeatureId(featureId);

    try {
      const updatedFeature = await earlyPreviewService.voteForFeature(featureId, type);

      // Update the features list with the new vote counts
      setFeatures(prevFeatures =>
        prevFeatures.map(feature =>
          feature.id === featureId
            ? {
                ...feature,
                upvotes: updatedFeature.upvotes,
                downvotes: updatedFeature.downvotes,
              }
            : feature
        )
      );

      toast.success(t("earlyPreview.voteSuccess"));
    } catch (error) {
      toast.error(t("earlyPreview.voteError"), {
        description: error.message,
      });
    } finally {
      setVotingFeatureId(null);
    }
  };

  const handleOpenDebugLogs = async () => {
    try {
      await window.electron.openDebugLogs();
    } catch (error) {
      console.error("Failed to open debug logs:", error);
      toast.error(t("earlyPreview.debugLogError"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background">
      <div className="container mx-auto max-w-[1400px] p-4 md:p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <FlaskConical className="h-8 w-8 text-primary" />
              {t("earlyPreview.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("earlyPreview.description")}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.electron.openDiscord()}
          >
            <MessageSquare size={18} />
            {t("earlyPreview.joinDiscord")}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-3">
            {/* Warning Banner */}
            <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex gap-3 text-sm text-yellow-500">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>{t("earlyPreview.warning")}</p>
              </div>
            </Card>

            {/* Features List */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <FileSearch className="h-5 w-5" />
                {t("earlyPreview.experimentalFeatures")}
              </h2>
              <div className="space-y-4">
                {loading ? (
                  <Card className="flex items-center justify-center bg-card/30 p-12 backdrop-blur-sm">
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                  </Card>
                ) : features.length > 0 ? (
                  features.map(feature => (
                    <ExperimentalFeature
                      key={feature.id}
                      {...feature}
                      onVote={type => handleVote(feature.id, type)}
                      isVoting={votingFeatureId === feature.id}
                    />
                  ))
                ) : (
                  <Card className="flex items-center justify-center bg-card/30 p-12 backdrop-blur-sm">
                    <p className="text-muted-foreground">
                      {t("earlyPreview.noFeatures")}
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions Card */}
            <Card className="bg-card/30 p-6 backdrop-blur-sm">
              <h3 className="mb-4 font-semibold">{t("earlyPreview.actions")}</h3>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={handleOpenDebugLogs}
                >
                  <FileSearch size={18} />
                  {t("earlyPreview.openDebugFolder")}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => window.electron.openDiscord()}
                >
                  <MessageSquare size={18} />
                  {t("earlyPreview.requestFeature")}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => setReportDialogOpen(true)}
                >
                  <AlertTriangle size={18} />
                  {t("earlyPreview.reportIssue")}
                </Button>
              </div>
            </Card>

            {/* Information Card */}
            <Card className="space-y-4 bg-card/30 p-6 backdrop-blur-sm">
              <h3 className="font-semibold">{t("earlyPreview.helpUsImprove")}</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <MessageSquare size={16} className="mt-0.5 shrink-0 text-primary" />
                  <p>{t("earlyPreview.discordInfo")}</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-500" />
                  <p>{t("earlyPreview.reportInfo")}</p>
                </div>
                <div className="flex items-start gap-2">
                  <FileSearch size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  <p>{t("earlyPreview.debugInfo")}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Report Issue Dialog */}
          {reportDialogOpen && (
            <ReportIssue
              open={reportDialogOpen}
              onOpenChange={setReportDialogOpen}
              context="early_preview"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EarlyPreviewDash;
