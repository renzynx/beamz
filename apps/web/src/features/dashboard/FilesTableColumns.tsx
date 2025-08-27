import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  FileText,
  Folder,
  Music,
  Play,
  PlayCircle,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { ButtonWithTooltip } from "@/components/ButtonWithTooltip";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFilesContext } from "@/contexts/FilesContext";
import { prefixWithCdn } from "@/features/dashboard/lib/utils";
import { parseFileMetadata } from "@/lib/metadata";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getFileType,
} from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { FileItem } from "@/trpc/types";
import Image from "next/image";

export const columns: ColumnDef<FileItem>[] = [
  {
    header: "Thumbnail",
    accessorKey: "thumbnail",
    cell: ({ row }) => {
      const file = row.original;
      const metadata = parseFileMetadata(file.metadata);

      // Fetch settings (suspense) to get CDN URL for prefixing thumbnails
      const trpc = useTRPC();
      const { data: settings } = useSuspenseQuery(
        trpc.settings.public.queryOptions(),
      );

      const thumbnailUrl = metadata?.thumbnail
        ? prefixWithCdn(
            `/api/f/${metadata.thumbnail}`,
            settings?.cdnUrl ?? null,
          )
        : null;

      const isVideo = file.mimeType.startsWith("video/");
      const isAudio = file.mimeType.startsWith("audio/");
      const isPdf = file.mimeType.includes("pdf");

      const getFileIcon = () => {
        if (isAudio) return <Music className="h-8 w-8 text-muted-foreground" />;
        if (isVideo)
          return <PlayCircle className="h-8 w-8 text-muted-foreground" />;
        if (isPdf)
          return <FileText className="h-8 w-8 text-muted-foreground" />;
        return <Folder className="h-8 w-8 text-muted-foreground" />;
      };

      return (
        <div className="flex h-12 w-16 items-center justify-center">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={file.originalName}
              width={56}
              height={56}
              className="h-10 w-14 rounded border object-cover"
            />
          ) : (
            <div className="flex h-10 w-14 items-center justify-center rounded border bg-muted">
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
        className="truncate pr-2 font-medium"
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
    size: 80,
  },
  {
    header: "Type",
    accessorKey: "mimeType",
    cell: ({ row }) => {
      const mimeType = row.getValue("mimeType") as string;

      return <Badge variant="secondary">{getFileType(mimeType)}</Badge>;
    },
    size: 80,
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
    size: 120,
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
    size: 180,
    enableSorting: false,
  },
];
