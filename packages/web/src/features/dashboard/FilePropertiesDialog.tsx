"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatFileSize, formatDate, getFileType } from "@/lib/utils";
import { parseFileMetadata } from "@/lib/metadata";
import { useMemo } from "react";
import { useFilesContext } from "../../contexts/FilesContext";

export function FilePropertiesDialog() {
  const { propertiesFile, setPropertiesFile } = useFilesContext();

  const metadata = useMemo(
    () =>
      propertiesFile?.metadata
        ? parseFileMetadata(propertiesFile.metadata)
        : null,
    [propertiesFile?.metadata]
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPropertiesFile(null);
    }
  };

  if (!propertiesFile) return null;

  return (
    <Dialog open={!!propertiesFile} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>File Properties</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-sm break-all">{propertiesFile.originalName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Size
                </label>
                <p className="text-sm">{formatFileSize(propertiesFile.size)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Type
                </label>
                <div>
                  <Badge variant="secondary" className="text-xs">
                    {getFileType(propertiesFile.mimeType)}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                MIME Type
              </label>
              <p className="text-sm font-mono text-muted-foreground">
                {propertiesFile.mimeType}
              </p>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Uploaded
                </label>
                <p className="text-sm">
                  {formatDate(propertiesFile.createdAt)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Modified
                </label>
                <p className="text-sm">
                  {formatDate(propertiesFile.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Media-specific metadata */}
          {metadata && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Media Information</h4>

                {/* Thumbnail info */}
                {metadata.thumbnail && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Thumbnail
                    </label>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {metadata.type === "album_cover"
                          ? "Album Cover"
                          : metadata.type === "waveform"
                            ? "Waveform"
                            : "Generated"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Preview info */}
                {metadata.preview && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Preview
                    </label>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Generated
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Technical Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Technical Details</h4>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                File Key
              </label>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {propertiesFile.key}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                File ID
              </label>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {propertiesFile.id}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
