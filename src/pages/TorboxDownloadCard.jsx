import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

/**
 * TorboxDownloadCard - simplified card for TorBox downloads
 * @param {object} props
 * @param {object} props.item - TorBox download item
 * @param {function=} props.onStop - Called when stop/delete is requested
 */
const TorboxDownloadCard = ({ item, onStop }) => {
  // Debug: log the item
  console.log("[TorboxDownloadCard] item:", item);

  // Fallbacks for missing fields
  const name = item?.name || item?.filename || "Unknown";
  // If progress is a float (0-1), convert to percent
  let progress = 0;
  if (typeof item?.progress === "number") {
    progress = item.progress > 1 ? item.progress : Math.round(item.progress * 100);
  } else if (typeof item?.percent === "number") {
    progress = item.percent;
  }
  const status = item?.download_state || item?.status || item?.state || "";
  const size = item?.size || item?.filesize || null;
  const downloaded = item?.downloaded || null;

  return (
    <Card className="border border-primary/30 bg-background/50">
      <CardContent className="flex flex-col gap-2 px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="max-w-[60%] truncate font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
        <Progress value={progress} className="mt-1 h-2" />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {downloaded && size ? `${downloaded} / ${size}` : size ? `${size}` : ""}
          </span>
          <span>{progress ? `${progress}%` : null}</span>
        </div>
        {onStop && (
          <Button size="sm" variant="outline" className="mt-2" onClick={onStop}>
            Stop
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TorboxDownloadCard;
