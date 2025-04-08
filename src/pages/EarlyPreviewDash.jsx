import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FlaskConical,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  FileSearch,
  AlertTriangle,
  FolderOpen,
  Loader,
  Eye,
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
  t,
}) => {
  const statusConfig = {
    active: { icon: FlaskConical, iconClass: "text-blue-500" },
    implemented: { icon: Eye, iconClass: "text-green-500" },
    deprecated: { icon: AlertTriangle, iconClass: "text-yellow-500" },
    trashed: { icon: FileSearch, iconClass: "text-red-500" },
  };

  const StatusIcon = statusConfig[status.toLowerCase()]?.icon || FlaskConical;
  const iconClass = statusConfig[status.toLowerCase()]?.iconClass || "text-primary";
  const totalVotes = upvotes + downvotes;
  const upvotePercentage = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0;
  const isVotingDisabled =
    status.toLowerCase() === "implemented" || status.toLowerCase() === "trashed";

  return (
    <Card
      className={`group relative overflow-hidden border-0 bg-gradient-to-br from-card/80 via-card/70 to-card/60 p-6 backdrop-blur-lg transition-all hover:shadow-lg ${status.toLowerCase() === "trashed" ? "opacity-50" : ""}`}
    >
      {/* Status Badge */}
      <div className="absolute right-4 top-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant={
                  status.toLowerCase() === "active"
                    ? "secondary"
                    : status.toLowerCase() === "implemented"
                      ? "success"
                      : status.toLowerCase() === "deprecated"
                        ? "warning"
                        : status.toLowerCase() === "trashed"
                          ? "destructive"
                          : "default"
                }
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium"
              >
                <StatusIcon className={`h-3 w-3 ${iconClass}`} />
                {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="w-64">
              <p className="text-center text-lg font-bold text-secondary">
                {t(`earlyPreview.status.${status.toLowerCase()}.title`)}
              </p>
              <p className="text-center text-xs text-secondary">
                {t(`earlyPreview.status.${status.toLowerCase()}.description`)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Voting Section */}
        <div className="space-y-2">
          {/* Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{ width: `${upvotePercentage}%` }}
            />
          </div>

          {/* Vote Stats and Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <ThumbsUp size={14} className="text-green-500" />
                <span className="text-muted-foreground">{upvotes}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ThumbsDown size={14} className="text-red-500" />
                <span className="text-muted-foreground">{downvotes}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {isVotingDisabled ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                  <span>{t("earlyPreview.votingClosed")}</span>
                </div>
              ) : isVoting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>{t("earlyPreview.votingInProgress")}</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-8 overflow-hidden px-3 text-muted-foreground hover:text-muted-foreground"
                    onClick={() => onVote("up")}
                    disabled={isVoting || isVotingDisabled}
                  >
                    <span className="flex items-center gap-1.5 [&>svg]:hover:-translate-y-0.5 [&>svg]:hover:text-green-500">
                      <ThumbsUp
                        size={14}
                        className="text-green-500/70 transition-all duration-150"
                      />
                      <span>{t("earlyPreview.voteUp")}</span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-8 overflow-hidden px-3 text-muted-foreground hover:text-muted-foreground"
                    onClick={() => onVote("down")}
                    disabled={isVoting || isVotingDisabled}
                  >
                    <span className="flex items-center gap-1.5 [&>svg]:hover:translate-y-0.5 [&>svg]:hover:text-red-500">
                      <ThumbsDown
                        size={14}
                        className="text-red-500/70 transition-all duration-150"
                      />
                      <span>{t("earlyPreview.voteDown")}</span>
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const EarlyPreviewDash = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [changes, setChanges] = useState([]);
  const [earlyBuild, setEarlyBuild] = useState("");
  const [releasedVersion, setReleasedVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [votingFeatureId, setVotingFeatureId] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const data = await earlyPreviewService.fetchEarlyChanges();
        setChanges(data.changes);
        setEarlyBuild(data.earlyBuild);
        setReleasedVersion(data.releasedVersion);
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
      setChanges(prevChanges =>
        prevChanges.map(change =>
          change.title === featureId
            ? {
                ...change,
                thumbsup: updatedFeature.thumbsup,
                thumbsdown: updatedFeature.thumbsdown,
              }
            : change
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
    <div className="mt-8 min-h-screen bg-gradient-to-br from-background via-background/95 to-background">
      <div className="container mx-auto max-w-[1400px] p-4 md:p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Eye className="h-8 w-8 text-primary" />
              {t("earlyPreview.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t("earlyPreview.description")}
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.electron.openURL("https://ascendara.app/discord")}
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
                ) : changes.length > 0 ? (
                  <>
                    <div className="mb-4 flex items-center gap-4">
                      <Badge variant="secondary" className="text-sm">
                        {t("earlyPreview.earlyBuild")}: {earlyBuild}
                      </Badge>
                      <Badge variant="outline" className="text-sm">
                        {t("earlyPreview.released")}: {releasedVersion}
                      </Badge>
                    </div>
                    {changes.map(change => (
                      <ExperimentalFeature
                        key={change.title}
                        title={change.title}
                        description={change.description}
                        status={change.status}
                        upvotes={change.thumbsup}
                        downvotes={change.thumbsdown}
                        t={t}
                        onVote={type => handleVote(change.title, type)}
                        isVoting={votingFeatureId === change.title}
                      />
                    ))}
                  </>
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
                  onClick={() => window.electron.openGameDirectory("debuglog")}
                >
                  <FileSearch size={18} />
                  {t("earlyPreview.openDebugFolder")}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() =>
                    window.electron.openURL("https://ascendara.app/feedback")
                  }
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
          <ReportIssue
            isOpen={reportDialogOpen}
            onClose={() => setReportDialogOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default EarlyPreviewDash;
