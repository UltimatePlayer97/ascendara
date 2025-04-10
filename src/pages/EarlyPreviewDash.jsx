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
  ArrowLeft,
} from "lucide-react";
import earlyPreviewService from "@/services/earlyPreviewService";
import ReportIssue from "@/components/ReportIssue";
import { useNavigate } from "react-router-dom";

const ExperimentalFeature = ({
  id,
  title,
  description,
  status,
  upvotes,
  downvotes,
  onVote,
  isVoting,
  userVote,
  t,
}) => {
  const statusConfig = {
    active: { icon: FlaskConical, iconClass: "text-blue-500" },
    implemented: { icon: Eye, iconClass: "text-green-500" },
    deprecated: { icon: AlertTriangle, iconClass: "text-yellow-500" },
    trashed: { icon: FileSearch, iconClass: "text-red-500" },
  };

  // Default to 'active' if status is undefined
  const normalizedStatus = (status || "active").toLowerCase();
  const StatusIcon = statusConfig[normalizedStatus]?.icon || FlaskConical;
  const iconClass = statusConfig[normalizedStatus]?.iconClass || "text-primary";
  const totalVotes = upvotes + downvotes;
  const upvotePercentage = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0;
  const isVotingDisabled =
    normalizedStatus === "implemented" || normalizedStatus === "trashed";

  return (
    <Card
      className={`group relative overflow-hidden border-0 bg-gradient-to-br from-card/80 via-card/70 to-card/60 p-6 backdrop-blur-lg transition-all hover:shadow-lg ${normalizedStatus === "trashed" ? "opacity-50" : ""}`}
    >
      {/* Status Badge */}
      <div className="absolute right-4 top-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Badge
                variant={
                  normalizedStatus === "active"
                    ? "secondary"
                    : normalizedStatus === "implemented"
                      ? "success"
                      : normalizedStatus === "deprecated"
                        ? "warning"
                        : normalizedStatus === "trashed"
                          ? "destructive"
                          : "default"
                }
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium"
              >
                <StatusIcon className={`h-3 w-3 ${iconClass}`} />
                {(status || "active").charAt(0).toUpperCase() +
                  (status || "active").slice(1).toLowerCase()}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="w-64">
              <p className="text-center text-lg font-bold text-secondary">
                {t(`earlyPreview.status.${normalizedStatus}.title`)}
              </p>
              <p className="text-center text-xs text-secondary">
                {t(`earlyPreview.status.${normalizedStatus}.description`)}
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
              ) : userVote ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {t(
                      userVote === "up"
                        ? "earlyPreview.votedUp"
                        : "earlyPreview.votedDown"
                    )}
                  </span>
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
  const [changes, setChanges] = useState([]);
  const [earlyBuild, setEarlyBuild] = useState("");
  const [releasedVersion, setReleasedVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [votingFeatureId, setVotingFeatureId] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [isExperiment, setIsExperiment] = useState(false);
  const [userVotes, setUserVotes] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const checkExperiment = async () => {
      const isExperiment = await window.electron.isExperiment();
      setIsExperiment(isExperiment);
    };
    checkExperiment();
  }, []);

  useEffect(() => {
    // Load user votes from localStorage
    const savedVotes = localStorage.getItem("earlyPreviewVotes");
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }

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
    // Check if user has already voted
    if (userVotes[featureId]) {
      toast.error(t("earlyPreview.alreadyVoted"));
      return;
    }

    setVotingFeatureId(featureId);

    try {
      const updatedFeature = await earlyPreviewService.voteForFeature(featureId, type);

      // Update the features list with the new vote counts
      setChanges(prevChanges =>
        prevChanges.map(change =>
          change.id === featureId
            ? updatedFeature // Replace entire feature with server response
            : change
        )
      );

      // Save vote to localStorage
      const newVotes = { ...userVotes, [featureId]: type };
      setUserVotes(newVotes);
      localStorage.setItem("earlyPreviewVotes", JSON.stringify(newVotes));

      toast.success(
        t(type === "up" ? "earlyPreview.voteUpSuccess" : "earlyPreview.voteDownSuccess")
      );
    } catch (error) {
      toast.error(t("earlyPreview.voteError"), {
        description: error.message,
      });
    } finally {
      setVotingFeatureId(null);
    }
  };

  return (
    <div className="mt-8 min-h-screen bg-gradient-to-br from-background via-background/95 to-background">
      <div className="ml-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
          className="rounded-full hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </div>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16px"
              height="16px"
              viewBox="0 -28.5 256 256"
              version="1.1"
              preserveAspectRatio="xMidYMid"
            >
              <g>
                <path
                  d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                  fill="currentColor"
                />
              </g>
            </svg>
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
            {isExperiment ? (
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
                          key={change.id}
                          id={change.id}
                          title={change.title}
                          description={change.description}
                          status={change.status}
                          upvotes={change.thumbsup}
                          downvotes={change.thumbsdown}
                          t={t}
                          onVote={type => handleVote(change.id, type)}
                          isVoting={votingFeatureId === change.id}
                          userVote={userVotes[change.id]}
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
            ) : (
              <Card className="mx-auto max-w-4xl bg-card/30 p-8 text-center backdrop-blur-sm">
                <h2 className="mb-4 text-2xl font-semibold text-primary">
                  {t("earlyPreview.noExperimentalFeatures")}
                </h2>
                <p className="text-muted-foreground">
                  {t("earlyPreview.getOnExperimental")}
                </p>
              </Card>
            )}
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
