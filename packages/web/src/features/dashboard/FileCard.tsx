"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatFileSize, formatRelativeTime, getFileType } from "@/lib/utils";
import {
  parseFileMetadata,
  getThumbnailUrl,
  getPreviewUrl,
  hasThumbnail,
  hasPreview,
} from "@/lib/metadata";
import {
  PlayCircle,
  Play,
  Music,
  FileText,
  Folder,
  Download,
  Settings,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { FileItem } from "@/trpc/types";
import { useFilesContext } from "@/contexts/FilesContext";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { prefixWithCdn } from "@/features/dashboard/lib/utils";

interface FileCardProps {
  file: FileItem;
  isSelected: boolean;
  onToggleSelection: (fileId: string) => void;
}

export function FileCard({
  file,
  isSelected,
  onToggleSelection,
}: FileCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const {
    downloadFile,
    regenerateThumbnail,
    showDeleteConfirmation,
    showProperties,
    showPreview,
    isRegeneratingThumbnail,
  } = useFilesContext();

  const metadata = useMemo(
    () => parseFileMetadata(file.metadata),
    [file.metadata]
  );

  const trpc = useTRPC();
  const { data: settings } = useSuspenseQuery(
    trpc.settings.public.queryOptions()
  );

  const isVideo = file.mimeType.startsWith("video/");
  const isAudio = file.mimeType.startsWith("audio/");
  const isPdf = file.mimeType.includes("pdf");

  const thumbnailUrl = getThumbnailUrl(metadata);
  const previewUrl = getPreviewUrl(metadata);
  const hasValidThumbnail = hasThumbnail(metadata);
  const hasValidPreview = hasPreview(metadata);

  const thumbnailUrlPrefixed = thumbnailUrl
    ? prefixWithCdn(thumbnailUrl, settings?.cdnUrl ?? null)
    : thumbnailUrl;
  const previewUrlPrefixed = previewUrl
    ? prefixWithCdn(previewUrl, settings?.cdnUrl ?? null)
    : previewUrl;

  const getFileIcon = () => {
    if (isAudio) return <Music className="w-12 h-12 text-muted-foreground" />;
    if (isVideo)
      return <PlayCircle className="w-12 h-12 text-muted-foreground" />;
    if (isPdf) return <FileText className="w-12 h-12 text-muted-foreground" />;
    return <Folder className="w-12 h-12 text-muted-foreground" />;
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      downloadFile(file);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleProperties = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      showProperties(file);
    } catch (error) {
      console.error("Properties error:", error);
    }
  };

  const handleRegenerateThumbnail = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      await regenerateThumbnail(file);
    } catch (error) {
      console.error("Regenerate thumbnail error:", error);
    }
  };

  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      showDeleteConfirmation(file);
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handlePreview = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      showPreview(file);
    } catch (error) {
      console.error("Preview error:", error);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`bg-card rounded-xl border hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer ${
            isSelected ? "ring-2 ring-primary bg-primary/5" : ""
          }`}
          onClick={() => onToggleSelection(file.id)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className="relative aspect-video bg-muted overflow-hidden">
            {hasValidThumbnail && thumbnailUrl && !imageError ? (
              <>
                {isVideo &&
                isHovering &&
                hasValidPreview &&
                previewUrlPrefixed &&
                !videoError ? (
                  <video
                    src={previewUrlPrefixed}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    onError={() => setVideoError(true)}
                  />
                ) : (
                  <img
                    src={thumbnailUrlPrefixed || thumbnailUrl}
                    alt={file.originalName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    onError={() => {
                      setImageError(true);
                    }}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                {getFileIcon()}
              </div>
            )}

            {isVideo && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                <PlayCircle className="w-3 h-3 inline mr-1" />
                Video
              </div>
            )}

            {isAudio && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                <Music className="w-3 h-3 inline mr-1" />
                Audio
              </div>
            )}

            <div className="absolute top-2 right-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelection(file.id)}
                aria-label={`Select ${file.originalName}`}
                className="bg-black/20 border-white/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="p-3 space-y-2">
            {/* Title */}
            <h3
              className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors"
              title={file.originalName}
            >
              {file.originalName}
            </h3>

            {/* Metadata row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatFileSize(file.size)}</span>
              <div className="flex items-center gap-1">
                {/* Show thumbnail type for audio files */}
                {isAudio && metadata?.type === "album_cover" && (
                  <Badge variant="outline" className="text-xs">
                    Album
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {getFileType(file.mimeType)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {file.createdAt
                  ? formatRelativeTime(file.createdAt)
                  : "Unknown date"}
              </span>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handlePreview}>
          <Play className="mr-2 h-4 w-4" />
          Preview
        </ContextMenuItem>

        <ContextMenuItem onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </ContextMenuItem>

        <ContextMenuItem onClick={handleProperties}>
          <Settings className="mr-2 h-4 w-4" />
          Properties
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={handleRegenerateThumbnail}
          disabled={isRegeneratingThumbnail}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRegeneratingThumbnail ? "animate-spin" : ""}`}
          />
          Regenerate Thumbnail
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleDelete} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
