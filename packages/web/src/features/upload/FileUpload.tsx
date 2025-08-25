"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileItem } from "./FileItem";
import { useChunkedUpload } from "@/hooks/use-chunked-upload";
import {
  UploadIcon,
  PlayIcon,
  TrashIcon,
  CheckCircleIcon,
  FolderOpenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

interface FileUploadProps {
  className?: string;
}

export function FileUpload({ className }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.settings.public.queryOptions());
  const blacklistedExtensions = data.blackListedExtensions || [];

  const {
    files,
    isUploading,
    addFiles,
    removeFile,
    startUploads,
    cancelUpload,
    retryUpload,
    clearCompleted,
    clearAll,
    checkUploadStatus,
    pauseUpload,
    resumeUpload,
  } = useChunkedUpload({
    chunkSize: data.chunkSize,
    onUploadComplete: (file) => {
      console.log("Upload completed:", file);
    },
    onUploadError: (file, error) => {
      console.error("Upload error:", error);
      if (error.includes("aborted") || error.includes("cancelled")) {
        toast.info(`Upload cancelled: ${file.file.name}`);
      } else {
        toast.error(`Upload failed: ${file.file.name} - ${error}`);
      }
    },
  });

  // Monitor upload completion and show success toast when all uploads are done
  useEffect(() => {
    if (files.length === 0 || isUploading) return;

    const completedFiles = files.filter((f) => f.status === "completed");
    const failedFiles = files.filter((f) => f.status === "error");
    const totalProcessedFiles = completedFiles.length + failedFiles.length;

    // Check if all files have been processed (completed or failed)
    if (totalProcessedFiles === files.length && completedFiles.length > 0) {
      // Create a batch ID based on the current files to avoid duplicate toasts
      const currentBatchId = files
        .map((f) => f.id)
        .sort()
        .join(",");

      if (currentBatchId !== lastBatchId) {
        setLastBatchId(currentBatchId);

        if (completedFiles.length === 1 && totalProcessedFiles === 1) {
          toast.success(`Upload completed: ${completedFiles[0].file.name}`);
        } else {
          const message =
            failedFiles.length > 0
              ? `${completedFiles.length} of ${files.length} files uploaded successfully.`
              : `All uploads completed! ${completedFiles.length} file${completedFiles.length !== 1 ? "s" : ""} uploaded successfully.`;
          toast.success(message);
        }
      }
    }
  }, [files, isUploading, lastBatchId]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > data.maxFileSize) {
        return `File size exceeds ${formatFileSize(data.maxFileSize)} limit`;
      }

      // Check if file extension is blacklisted
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (fileExtension && blacklistedExtensions.length > 0) {
        const isBlacklisted = blacklistedExtensions.some((ext) => {
          const cleanExt = ext.startsWith(".")
            ? ext.slice(1).toLowerCase()
            : ext.toLowerCase();
          return cleanExt === fileExtension;
        });

        if (isBlacklisted) {
          return `File type "${fileExtension}" is not allowed`;
        }
      }

      return null;
    },
    [data.maxFileSize, blacklistedExtensions]
  );

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);

      // Validate each file
      const validFiles: File[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        toast.error(`Error:\n${errors.join("\n")}`);
      }

      if (validFiles.length > 0) {
        addFiles(validFiles);
        // Reset batch ID when new files are added
        setLastBatchId(null);
      }
    },
    [files.length, validateFile, addFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
        // Reset input value to allow selecting the same file again
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragOver(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragOver(false);
      setDragCounter(0);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const completedFiles = files.filter((f) => f.status === "completed");
  const pendingFiles = files.filter((f) => f.status === "pending");
  const pausedFiles = files.filter((f) => f.status === "paused");
  const hasCompletedFiles = completedFiles.length > 0;

  const handleCheckStatus = useCallback(
    async (fileId: string) => {
      try {
        const status = await checkUploadStatus(fileId);
        const file = files.find((f) => f.id === fileId);
        toast.info(
          `Upload status for ${file?.file.name}: ${status.receivedChunks}/${status.totalChunks} chunks (${status.progress}%)`
        );
      } catch (error) {
        toast.error("Failed to check upload status");
      }
    },
    [checkUploadStatus, files]
  );

  const handlePause = useCallback(
    (fileId: string) => {
      pauseUpload(fileId);
      const file = files.find((f) => f.id === fileId);
      toast.info(`Upload paused: ${file?.file.name}`);
      console.log(
        `Paused upload for file: ${file?.file.name}, uploadId: ${file?.uploadId}`
      );
    },
    [pauseUpload, files]
  );

  const handleResume = useCallback(
    async (fileId: string) => {
      try {
        const file = files.find((f) => f.id === fileId);
        console.log(
          `Attempting to resume upload for file: ${file?.file.name}, uploadId: ${file?.uploadId}, status: ${file?.status}`
        );
        await resumeUpload(fileId);
        toast.info(`Resuming upload: ${file?.file.name}`);
      } catch (error) {
        console.error("Resume upload error:", error);
        toast.error("Failed to resume upload");
      }
    },
    [resumeUpload, files]
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer min-h-64 flex items-center justify-center",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          isUploading && "pointer-events-none opacity-50"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="space-y-4">
          <div
            className={cn(
              "mx-auto size-12 text-muted-foreground transition-colors",
              isDragOver && "text-primary"
            )}
          >
            {isDragOver ? (
              <UploadIcon className="size-12" />
            ) : (
              <FolderOpenIcon className="size-12" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragOver
                ? "Drop files here"
                : "Drag & drop files here, or click to browse"}
            </p>
            <p className="text-sm text-muted-foreground">
              Upload up to {formatFileSize(data.maxFileSize)} each
              {blacklistedExtensions.length > 0 && (
                <span className="block mt-1">
                  Blocked file types: {blacklistedExtensions.join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Upload Controls */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
            {pendingFiles.length > 0 && (
              <span className="ml-2">({pendingFiles.length} pending)</span>
            )}
            {pausedFiles.length > 0 && (
              <span className="ml-2">({pausedFiles.length} paused)</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {hasCompletedFiles && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearCompleted}
                disabled={isUploading}
              >
                <CheckCircleIcon className="size-4 mr-2" />
                Clear Completed
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={isUploading}
            >
              <TrashIcon className="size-4 mr-2" />
              Clear All
            </Button>

            <Button
              onClick={startUploads}
              disabled={
                isUploading ||
                (pendingFiles.length === 0 && pausedFiles.length === 0)
              }
              size="sm"
            >
              <PlayIcon className="size-4 mr-2" />
              {isUploading ? "Uploading..." : "Start Upload"}
            </Button>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((uploadFile) => (
            <FileItem
              key={uploadFile.id}
              uploadFile={uploadFile}
              onRemove={removeFile}
              onCancel={cancelUpload}
              onRetry={retryUpload}
              onPause={handlePause}
              onResume={handleResume}
              onCheckStatus={handleCheckStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
