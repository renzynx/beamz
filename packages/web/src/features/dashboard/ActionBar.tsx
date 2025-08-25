"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useFilesContext } from "../../contexts/FilesContext";
import { useState } from "react";
import type { FileItem } from "@/trpc/types";
import { ShareDialog } from "./ShareDialog";

interface ActionBarProps {
  selectedCount: number;
  // optional list of selected file objects (if available)
  selectedItems?: FileItem[];
}

export function ActionBar({ selectedCount, selectedItems }: ActionBarProps) {
  const { selectedFiles, deselectAllFiles, showBulkDeleteConfirmation } =
    useFilesContext();
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleDownload = () => {
    // TODO: Implement bulk download
    toast.info("Download functionality coming soon");
  };

  const handleDelete = () => {
    const fileIds = Array.from(selectedFiles);
    if (fileIds.length > 0) {
      showBulkDeleteConfirmation(fileIds);
    }
  };

  const handleShare = () => {
    // Open the share dialog
    if (
      (!selectedItems || selectedItems.length === 0) &&
      selectedFiles.size === 0
    ) {
      toast.info("No files selected to share");
      return;
    }
    setIsShareOpen(true);
  };

  const handleTag = () => {
    // TODO: Implement tagging
    toast.info("Tag functionality coming soon");
  };

  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 transform -translate-x-1/2 z-50",
        "bg-background/80 backdrop-blur-md text-foreground px-4 py-3 rounded-lg border shadow-lg",
        "animate-in slide-in-from-top-2 duration-300 ease-out",
        "max-w-2xl w-full mx-4"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="default">{selectedCount} selected</Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary actions */}
          <Button size="sm" variant="secondary" onClick={handleDownload}>
            <Download size={16} className="mr-2" />
            Download
          </Button>

          <Button size="sm" variant="secondary" onClick={handleShare}>
            <Share size={16} className="mr-2" />
            Share
          </Button>

          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>

          {/* Clear selection */}
          <Button
            className="cursor-pointer"
            size="sm"
            variant="ghost"
            onClick={deselectAllFiles}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        selectedItems={selectedItems}
      />
    </div>
  );
}
