"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFilesContext } from "@/contexts/FilesContext";
import {
  parseFileMetadata,
  hasPreview,
  getPreviewUrl,
  getThumbnailUrl,
  hasThumbnail,
} from "@/lib/metadata";
import { formatFileSize } from "@/lib/utils";
import { Download, X } from "lucide-react";

export function FilePreviewDialog() {
  const { previewFile, setPreviewFile, downloadFile } = useFilesContext();

  const isOpen = !!previewFile;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPreviewFile(null);
    }
  };

  if (!previewFile) return null;

  const metadata = parseFileMetadata(previewFile.metadata);
  const previewUrl = getPreviewUrl(metadata);
  const thumbnailUrl = getThumbnailUrl(metadata);
  const canPreview = hasPreview(metadata);
  const canShowThumbnail = hasThumbnail(metadata);

  const isImage = previewFile.mimeType.startsWith("image/");
  const isVideo = previewFile.mimeType.startsWith("video/");
  const isAudio = previewFile.mimeType.startsWith("audio/");

  const getPreviewContent = () => {
    // For images, show the original file directly
    if (isImage) {
      return (
        <img
          src={`/api/f/${previewFile.key}.${previewFile.originalName.split(".").pop()}`}
          alt={previewFile.originalName}
          className="max-w-full max-h-[60vh] object-contain rounded"
        />
      );
    }

    // For videos, show preview if available, otherwise thumbnail
    if (isVideo) {
      if (canPreview && previewUrl) {
        return (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-[60vh] rounded"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        );
      } else if (canShowThumbnail && thumbnailUrl) {
        return (
          <div className="flex flex-col items-center gap-4">
            <img
              src={thumbnailUrl}
              alt={previewFile.originalName}
              className="max-w-full max-h-[40vh] object-contain rounded"
            />
            <p className="text-sm text-muted-foreground">
              Video preview not available. Download to view full video.
            </p>
          </div>
        );
      }
    }

    // For audio, show thumbnail if available
    if (isAudio && canShowThumbnail && thumbnailUrl) {
      return (
        <div className="flex flex-col items-center gap-4">
          <img
            src={thumbnailUrl}
            alt={previewFile.originalName}
            className="max-w-full max-h-[40vh] object-contain rounded"
          />
          <p className="text-sm text-muted-foreground">
            Audio file. Download to play.
          </p>
        </div>
      );
    }

    // Fallback for unsupported files
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-6xl text-muted-foreground">📄</div>
        <div className="text-center">
          <p className="text-lg font-medium">{previewFile.originalName}</p>
          <p className="text-sm text-muted-foreground">
            Preview not available for this file type.
          </p>
          <p className="text-sm text-muted-foreground">
            Download to view the file.
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-fit max-h-[80vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate pr-2">
                {previewFile.originalName}
              </DialogTitle>
              <DialogDescription>
                {formatFileSize(previewFile.size)} • {previewFile.mimeType}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[200px]">
          {getPreviewContent()}
        </div>

        <div className="flex justify-center mt-4">
          <Button
            size="lg"
            onClick={() => downloadFile(previewFile)}
            className="gap-2"
          >
            <Download size={16} />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
