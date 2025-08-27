"use client";

import type {
  UploadFile,
  UploadProgress,
  UseChunkedUploadOptions,
} from "@/features/upload/types";
import { ChunkedUploader, createFileChunks } from "@/features/upload/utils";
import { useCallback, useRef, useState } from "react";

export function useChunkedUpload(options: UseChunkedUploadOptions) {
  const {
    chunkSize,
    maxConcurrentUploads = 3,
    onUploadComplete,
    onUploadError,
    onProgress,
  } = options;

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploaderRef = useRef(new ChunkedUploader());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pausedUploadsRef = useRef<Set<string>>(new Set()); // Track paused uploads

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const uploadFiles: UploadFile[] = newFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: {
          uploadedBytes: 0,
          totalBytes: file.size,
          percentage: 0,
          chunksUploaded: 0,
          totalChunks: Math.ceil(file.size / chunkSize),
        },
        status: "pending",
      }));

      setFiles((prev) => [...prev, ...uploadFiles]);
      return uploadFiles;
    },
    [chunkSize],
  );

  const removeFile = useCallback((fileId: string) => {
    // Remove from paused set
    pausedUploadsRef.current.delete(fileId);

    // Cancel upload if in progress
    const abortController = abortControllersRef.current.get(fileId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(fileId);
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const uploadFile = useCallback(
    async (uploadFile: UploadFile) => {
      const abortController = new AbortController();
      abortControllersRef.current.set(uploadFile.id, abortController);

      console.log(`Starting upload for ${uploadFile.file.name}`);

      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: "uploading" as const } : f,
          ),
        );

        let uploadId = uploadFile.uploadId;

        // Initialize upload only if we don't have an uploadId yet
        if (!uploadId) {
          console.log(`Initializing upload for ${uploadFile.file.name}`);
          uploadId = await uploaderRef.current.initUpload(
            uploadFile.file.name,
            uploadFile.file.size,
          );
          console.log(`Upload initialized with ID: ${uploadId}`);

          // Update file with uploadId
          setFiles((prev) =>
            prev.map((f) => (f.id === uploadFile.id ? { ...f, uploadId } : f)),
          );
        } else {
          console.log(`Resuming existing upload with ID: ${uploadId}`);
        }

        // Create chunks
        const chunks = createFileChunks(uploadFile.file, chunkSize);
        console.log(
          `Created ${chunks.length} chunks for ${uploadFile.file.name}`,
        );

        // Check if this is a resume operation by checking server status
        const startFromChunk = 0;
        try {
          const serverStatus =
            await uploaderRef.current.getUploadStatus(uploadId);
          if (serverStatus.receivedChunks > 0) {
            console.log(
              `Server has ${serverStatus.receivedChunks}/${serverStatus.totalChunks} chunks`,
            );
            console.log(`Missing chunks: ${serverStatus.missingChunks}`);

            // Only upload missing chunks, not from receivedChunks
            if (serverStatus.missingChunks.length === 0) {
              console.log("All chunks already uploaded, finishing upload");
              const uploadResponse =
                await uploaderRef.current.finishUpload(uploadId);

              const completedFile: UploadFile = {
                ...uploadFile,
                status: "completed",
                uploadResponse,
                progress: {
                  uploadedBytes: uploadFile.file.size,
                  totalBytes: uploadFile.file.size,
                  percentage: 100,
                  chunksUploaded: chunks.length,
                  totalChunks: chunks.length,
                },
              };

              setFiles((prev) =>
                prev.map((f) => (f.id === uploadFile.id ? completedFile : f)),
              );
              onUploadComplete?.(completedFile);
              return;
            }

            // Update progress to show current state
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? {
                      ...f,
                      progress: {
                        ...f.progress,
                        chunksUploaded: serverStatus.receivedChunks,
                        percentage: serverStatus.progress,
                        uploadedBytes: Math.floor(
                          (serverStatus.progress / 100) * serverStatus.size,
                        ),
                      },
                    }
                  : f,
              ),
            );
          }
        } catch (_error) {
          // If status check fails, start from beginning
          console.log("Could not check server status, starting from beginning");
        }

        let uploadedChunks = startFromChunk;

        // Get missing chunks from server if available
        let missingChunks: number[] = [];
        try {
          const serverStatus =
            await uploaderRef.current.getUploadStatus(uploadId);
          missingChunks = serverStatus.missingChunks;
          uploadedChunks = serverStatus.receivedChunks;
        } catch (_error) {
          // If we can't get server status, upload all chunks
          missingChunks = Array.from({ length: chunks.length }, (_, i) => i);
        }

        // Upload only missing chunks
        for (const chunkIndex of missingChunks) {
          if (chunkIndex >= chunks.length) continue; // Safety check

          const chunk = chunks[chunkIndex];

          // Check if upload was paused
          if (pausedUploadsRef.current.has(uploadFile.id)) {
            console.log(`Upload paused for ${uploadFile.file.name}`);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id
                  ? { ...f, status: "paused" as const }
                  : f,
              ),
            );
            return; // Exit without error
          }

          // Check if upload was cancelled
          if (abortController.signal.aborted) {
            throw new Error("Upload cancelled");
          }

          console.log(
            `Uploading chunk ${chunkIndex + 1}/${chunks.length} for ${uploadFile.file.name}`,
          );

          try {
            // Enhanced chunk upload with progress tracking and abort signal
            await uploaderRef.current.uploadChunk(
              uploadId,
              chunk.chunk,
              chunk.offset,
              (loaded, total) => {
                // Real-time progress tracking for this specific chunk
                const chunkProgress = (loaded / total) * 100;
                const baseProgress = (chunkIndex / chunks.length) * 100;
                const currentChunkContribution = (1 / chunks.length) * 100;
                const totalProgress =
                  baseProgress +
                  (chunkProgress / 100) * currentChunkContribution;

                const newProgress: UploadProgress = {
                  uploadedBytes: Math.floor(
                    (totalProgress / 100) * uploadFile.file.size,
                  ),
                  totalBytes: uploadFile.file.size,
                  percentage: totalProgress,
                  chunksUploaded: chunkIndex + loaded / total,
                  totalChunks: chunks.length,
                };

                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === uploadFile.id
                      ? { ...f, progress: newProgress }
                      : f,
                  ),
                );

                onProgress?.({ ...uploadFile, progress: newProgress });
              },
              abortController.signal,
            );

            // After successful chunk upload, get updated server status for accuracy
            try {
              const updatedStatus =
                await uploaderRef.current.getUploadStatus(uploadId);
              const newProgress: UploadProgress = {
                uploadedBytes: Math.floor(
                  (updatedStatus.progress / 100) * updatedStatus.size,
                ),
                totalBytes: uploadFile.file.size,
                percentage: updatedStatus.progress,
                chunksUploaded: updatedStatus.receivedChunks,
                totalChunks: chunks.length,
              };

              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id ? { ...f, progress: newProgress } : f,
                ),
              );

              onProgress?.({ ...uploadFile, progress: newProgress });
            } catch (_statusError) {
              // Fallback to simple calculation if status check fails
              uploadedChunks++;
              const uploadedBytes = uploadedChunks * chunkSize;
              const actualUploadedBytes = Math.min(
                uploadedBytes,
                uploadFile.file.size,
              );
              const percentage =
                (actualUploadedBytes / uploadFile.file.size) * 100;

              const newProgress: UploadProgress = {
                uploadedBytes: actualUploadedBytes,
                totalBytes: uploadFile.file.size,
                percentage,
                chunksUploaded: uploadedChunks,
                totalChunks: chunks.length,
              };

              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id ? { ...f, progress: newProgress } : f,
                ),
              );

              onProgress?.({ ...uploadFile, progress: newProgress });
            }
          } catch (error) {
            // If chunk upload fails with conflict, it might already be uploaded
            // Check if it's a 409 conflict error
            if (
              error instanceof Error &&
              (error.message.includes("409") ||
                error.message.includes("Conflict"))
            ) {
              console.log(
                `Chunk ${chunkIndex} already uploaded (409 Conflict), skipping`,
              );
              continue;
            }
            // Re-throw other errors
            throw error;
          }
        }

        console.log(
          `All chunks uploaded for ${uploadFile.file.name}, finishing upload...`,
        );
        // Finish upload
        const uploadResponse = await uploaderRef.current.finishUpload(uploadId);
        console.log(
          `Upload finished for ${uploadFile.file.name}:`,
          uploadResponse,
        );

        // Update status to completed
        const completedFile: UploadFile = {
          ...uploadFile,
          status: "completed",
          uploadResponse,
          progress: {
            uploadedBytes: uploadFile.file.size,
            totalBytes: uploadFile.file.size,
            percentage: 100,
            chunksUploaded: chunks.length,
            totalChunks: chunks.length,
          },
        };

        console.log(`Setting file ${uploadFile.file.name} to completed status`);
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? completedFile : f)),
        );

        console.log(`Calling onUploadComplete for ${uploadFile.file.name}`);
        onUploadComplete?.(completedFile);
      } catch (error) {
        console.error(`Upload error for ${uploadFile.file.name}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        // Check if this is an abort/cancellation, set appropriate status
        const isAborted =
          errorMessage.includes("aborted") ||
          errorMessage.includes("cancelled");

        const errorFile: UploadFile = {
          ...uploadFile,
          status: isAborted ? "cancelled" : "error",
          error: errorMessage,
        };

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? errorFile : f)),
        );

        onUploadError?.(errorFile, errorMessage);
      } finally {
        abortControllersRef.current.delete(uploadFile.id);
      }
    },
    [chunkSize, onUploadComplete, onUploadError, onProgress],
  );

  const startUploads = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Process files with concurrent upload limiting
      const uploadQueue = [...pendingFiles];
      const activeUploads = new Set<Promise<void>>();

      while (uploadQueue.length > 0 || activeUploads.size > 0) {
        // Start new uploads up to the concurrent limit
        while (
          uploadQueue.length > 0 &&
          activeUploads.size < maxConcurrentUploads
        ) {
          const file = uploadQueue.shift();

          if (!file) continue;

          const uploadPromise = uploadFile(file).finally(() => {
            activeUploads.delete(uploadPromise);
          });
          activeUploads.add(uploadPromise);
        }

        // Wait for at least one upload to complete before potentially starting more
        if (activeUploads.size > 0) {
          await Promise.race(activeUploads);
        }
      }
    } finally {
      setIsUploading(false);
    }
  }, [files, uploadFile, maxConcurrentUploads]);

  const cancelUpload = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);

      // Remove from paused set if it was paused
      pausedUploadsRef.current.delete(fileId);

      // Cancel the abort controller for this file
      const abortController = abortControllersRef.current.get(fileId);
      if (abortController) {
        abortController.abort();
        abortControllersRef.current.delete(fileId);
      }

      // If we have an uploadId, also cancel on the server
      if (file?.uploadId) {
        try {
          await uploaderRef.current.cancelUpload(file.uploadId);
          console.log(`Server-side upload cancelled for ${file.file.name}`);
        } catch (error) {
          console.error("Failed to cancel upload on server:", error);
          // Continue with client-side cancellation even if server call fails
        }
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId && (f.status === "uploading" || f.status === "paused")
            ? { ...f, status: "cancelled" as const }
            : f,
        ),
      );
    },
    [files],
  );

  const checkUploadStatus = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file?.uploadId) {
        throw new Error("No upload ID found for file");
      }

      try {
        const status = await uploaderRef.current.getUploadStatus(file.uploadId);
        console.log(`Upload status for ${file.file.name}:`, status);

        // Update file with server status
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  progress: {
                    ...f.progress,
                    chunksUploaded: status.receivedChunks,
                    totalChunks: status.totalChunks,
                    percentage: status.progress,
                    uploadedBytes: Math.floor(
                      (status.progress / 100) * status.size,
                    ),
                    totalBytes: status.size,
                  },
                }
              : f,
          ),
        );

        return status;
      } catch (error) {
        console.error("Failed to check upload status:", error);
        throw error;
      }
    },
    [files],
  );

  const pauseUpload = useCallback((fileId: string) => {
    console.log(`Pausing upload for file ID: ${fileId}`);

    // Add to paused set instead of aborting controller
    pausedUploadsRef.current.add(fileId);

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId && f.status === "uploading"
          ? { ...f, status: "paused" as const }
          : f,
      ),
    );
  }, []);

  const resumeUpload = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file) {
        console.error("Cannot resume: file not found");
        return;
      }

      if (file.status !== "paused" && file.status !== "error") {
        console.error("Cannot resume: file is not paused or in error state");
        return;
      }

      console.log(
        `Resuming upload for ${file.file.name}, uploadId: ${file.uploadId}`,
      );

      // Remove from paused set
      pausedUploadsRef.current.delete(fileId);

      // If we have an uploadId, check server status first
      if (file.uploadId) {
        try {
          const status = await uploaderRef.current.getUploadStatus(
            file.uploadId,
          );
          console.log(`Server status for ${file.file.name}:`, status);

          if (status.isComplete) {
            // Upload is already complete, just finish it
            const uploadResponse = await uploaderRef.current.finishUpload(
              file.uploadId,
            );
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      status: "completed",
                      uploadResponse,
                      progress: {
                        ...f.progress,
                        percentage: 100,
                        uploadedBytes: f.file.size,
                        chunksUploaded: status.totalChunks,
                        totalChunks: status.totalChunks,
                      },
                    }
                  : f,
              ),
            );
            onUploadComplete?.(file);
            return;
          }

          // Update progress with server state
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    progress: {
                      ...f.progress,
                      chunksUploaded: status.receivedChunks,
                      percentage: status.progress,
                      uploadedBytes: Math.floor(
                        (status.progress / 100) * status.size,
                      ),
                      totalChunks: status.totalChunks,
                    },
                  }
                : f,
            ),
          );
        } catch (error) {
          console.error(
            "Failed to check server status, will retry from current state:",
            error,
          );
        }
      }

      // Start the upload for this specific file (this will use existing uploadId if available)
      try {
        console.log(`Starting uploadFile for ${file.file.name}`);
        await uploadFile(file);
      } catch (error) {
        console.error("Failed to resume upload:", error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Resume failed",
                }
              : f,
          ),
        );
        onUploadError?.(
          file,
          error instanceof Error ? error.message : "Resume failed",
        );
      }
    },
    [files, uploadFile, onUploadComplete, onUploadError],
  );

  const retryUpload = useCallback(
    (fileId: string) => {
      // Remove from paused set
      pausedUploadsRef.current.delete(fileId);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId && (f.status === "error" || f.status === "cancelled")
            ? {
                ...f,
                status: "pending",
                error: undefined,
                uploadId: undefined, // Reset uploadId to force new initialization
                progress: {
                  uploadedBytes: 0,
                  totalBytes: f.file.size,
                  percentage: 0,
                  chunksUploaded: 0,
                  totalChunks: Math.ceil(f.file.size / chunkSize),
                },
              }
            : f,
        ),
      );
    },
    [chunkSize],
  );

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
  }, []);

  const clearAll = useCallback(() => {
    // Clear paused uploads
    pausedUploadsRef.current.clear();

    // Cancel all ongoing uploads
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();

    setFiles([]);
    setIsUploading(false);
  }, []);

  return {
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
  };
}
