import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseFileMetadata,
  getThumbnailUrl,
  hasThumbnail,
} from "@/lib/metadata";
import {
  formatFileSize,
  formatDate,
  formatRelativeTime,
  getFileType,
} from "@/lib/utils";
import { FileItem } from "@/trpc/types";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import {
  Music,
  PlayCircle,
  FileText,
  Folder,
  Download,
  Settings,
  RefreshCw,
  Trash2,
  Play,
} from "lucide-react";
import { useFilesContext } from "@/contexts/FilesContext";
import { ButtonWithTooltip } from "@/components/ButtonWithTooltip";

export const columns: ColumnDef<FileItem>[] = [
  {
    header: "Thumbnail",
    accessorKey: "thumbnail",
    cell: ({ row }) => {
      const file = row.original;
      const metadata = parseFileMetadata(file.metadata);
      const thumbnailUrl = getThumbnailUrl(metadata);
      const hasValidThumbnail = hasThumbnail(metadata);

      const isVideo = file.mimeType.startsWith("video/");
      const isAudio = file.mimeType.startsWith("audio/");
      const isPdf = file.mimeType.includes("pdf");

      const getFileIcon = () => {
        if (isAudio) return <Music className="w-8 h-8 text-muted-foreground" />;
        if (isVideo)
          return <PlayCircle className="w-8 h-8 text-muted-foreground" />;
        if (isPdf)
          return <FileText className="w-8 h-8 text-muted-foreground" />;
        return <Folder className="w-8 h-8 text-muted-foreground" />;
      };

      return (
        <div className="w-16 h-12 flex items-center justify-center">
          {hasValidThumbnail && thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={file.originalName}
              className="w-14 h-10 object-cover rounded border"
              loading="lazy"
            />
          ) : (
            <div className="w-14 h-10 flex items-center justify-center bg-muted rounded border">
              {getFileIcon()}
            </div>
          )}
        </div>
      );
    },
    size: 80,
    enableSorting: false,
  },
  {
    header: "File Name",
    accessorKey: "originalName",
    cell: ({ row }) => (
      <div
        className="font-medium truncate pr-2"
        title={row.getValue("originalName") as string}
      >
        {row.getValue("originalName")}
      </div>
    ),
    size: 220,
  },
  {
    header: "Size",
    accessorKey: "size",
    cell: ({ row }) => {
      const size = row.getValue("size") as number;
      return <div className="text-sm">{formatFileSize(size)}</div>;
    },
    size: 120,
  },
  {
    header: "Type",
    accessorKey: "mimeType",
    cell: ({ row }) => {
      const mimeType = row.getValue("mimeType") as string;

      return <Badge variant="secondary">{getFileType(mimeType)}</Badge>;
    },
    size: 100,
  },
  {
    header: "Uploaded",
    accessorKey: "createdAt",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date | null;
      if (!date) return <div className="text-sm">—</div>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm">{formatRelativeTime(date)}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{formatDate(date)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    size: 80,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const {
        downloadFile,
        showPreview,
        regenerateThumbnail,
        showDeleteConfirmation,
        showProperties,
        isRegeneratingThumbnail,
      } = useFilesContext();
      const file = row.original;

      const isImage = file.mimeType.startsWith("image/");
      const isVideo = file.mimeType.startsWith("video/");
      const isAudio = file.mimeType.startsWith("audio/");

      // Action handlers
      const handleDownload = (): void => downloadFile(file);
      const handleProperties = (): void => showProperties(file);
      const handleRegenerateThumbnail = (): void => regenerateThumbnail(file);
      const handleDelete = (): void => showDeleteConfirmation(file);
      const handlePreview = (): void => showPreview(file);

      return (
        <TooltipProvider>
          <div className="flex items-center gap-2 pr-4">
            <ButtonWithTooltip
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePreview}
              tooltip="Preview file"
              srLabel="Preview"
            >
              <Play className="h-4 w-4" />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleDownload}
              tooltip="Download file"
              srLabel="Download"
            >
              <Download className="h-4 w-4" />
            </ButtonWithTooltip>

            <ButtonWithTooltip
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleProperties}
              tooltip="View properties"
              srLabel="Properties"
            >
              <Settings className="h-4 w-4" />
            </ButtonWithTooltip>

            {(isImage || isVideo || isAudio) && (
              <ButtonWithTooltip
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleRegenerateThumbnail}
                isLoading={isRegeneratingThumbnail}
                tooltip="Regenerate thumbnail"
                loadingTooltip="Regenerating..."
                srLabel="Regenerate Thumbnail"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRegeneratingThumbnail ? "animate-spin" : ""}`}
                />
              </ButtonWithTooltip>
            )}

            <ButtonWithTooltip
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={handleDelete}
              tooltip="Delete file"
              srLabel="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </ButtonWithTooltip>
          </div>
        </TooltipProvider>
      );
    },
    size: 160,
    enableSorting: false,
  },
];
