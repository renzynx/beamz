"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/utils";
import {
  FileIcon,
  XIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  InfoIcon,
} from "lucide-react";
import { UploadFile } from "./types";

interface FileItemProps {
  uploadFile: UploadFile;
  onRemove: (fileId: string) => void;
  onCancel: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onCheckStatus?: (fileId: string) => void;
  showDownload?: boolean;
}

export function FileItem({
  uploadFile,
  onRemove,
  onCancel,
  onRetry,
  onPause,
  onResume,
  onCheckStatus,
  showDownload = true,
}: FileItemProps) {
  const { file, progress, status, error, uploadResponse } = uploadFile;

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "uploading":
        return <Badge variant="secondary">Uploading</Badge>;
      case "paused":
        return <Badge variant="outline">Paused</Badge>;
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="size-4 text-green-600" />;
      case "error":
        return <AlertCircleIcon className="size-4 text-red-600" />;
      case "uploading":
        return <RefreshCwIcon className="size-4 text-blue-600 animate-spin" />;
      case "paused":
        return <PauseIcon className="size-4 text-orange-600" />;
      default:
        return <FileIcon className="size-4 text-muted-foreground" />;
    }
  };

  const getDownloadUrl = () => {
    if (uploadResponse?.id) {
      return `/api/download/${uploadResponse.id}`;
    }
    return null;
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {getStatusIcon()}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium truncate">{file.name}</p>
              {getStatusBadge()}
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>{formatFileSize(file.size)}</span>
              {status === "uploading" && (
                <span>{Math.round(progress.percentage)}%</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-2">
          {status === "completed" && showDownload && getDownloadUrl() && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => window.open(getDownloadUrl()!, "_blank")}
              title="Download file"
            >
              <DownloadIcon className="size-4" />
            </Button>
          )}

          {status === "uploading" && onPause && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onPause(uploadFile.id)}
              title="Pause upload"
            >
              <PauseIcon className="size-4" />
            </Button>
          )}

          {status === "paused" && onResume && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onResume(uploadFile.id)}
              title="Resume upload"
            >
              <PlayIcon className="size-4" />
            </Button>
          )}

          {(status === "uploading" || status === "paused") && onCheckStatus && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onCheckStatus(uploadFile.id)}
              title="Check upload status"
            >
              <InfoIcon className="size-4" />
            </Button>
          )}

          {(status === "error" || status === "cancelled") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onRetry(uploadFile.id)}
              title="Retry upload"
            >
              <RefreshCwIcon className="size-4" />
            </Button>
          )}

          {status === "uploading" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onCancel(uploadFile.id)}
              title="Cancel upload"
            >
              <XIcon className="size-4" />
            </Button>
          )}

          {(status === "pending" ||
            status === "completed" ||
            status === "error" ||
            status === "cancelled") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onRemove(uploadFile.id)}
              title="Remove from list"
            >
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar for uploading/paused files */}
      {(status === "uploading" || status === "paused") && (
        <div className="space-y-1">
          <Progress value={progress.percentage} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(progress.uploadedBytes)} uploaded</span>
            <span>{formatFileSize(progress.totalBytes)} total</span>
          </div>
          {status === "paused" && (
            <div className="text-xs text-orange-600">
              Upload paused - click resume to continue
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {status === "error" && error && (
        <div className="text-xs text-destructive-foreground bg-destructive p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
