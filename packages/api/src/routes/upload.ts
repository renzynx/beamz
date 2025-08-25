import { db, files, user, eq, sql } from "@beam/db";
import { TEMP_DIR, UPLOAD_DIR } from "@/lib/constants";
import { SETTINGS } from "@/lib/settings";
import { isSupportedFileType } from "@/lib/thumbnail";
import type { UploadMetadata } from "@/lib/types";
import { formatFileSize, generateFileSlug, getStoredName } from "@/lib/utils";
import { generateId } from "better-auth";
import { fileTypeFromStream } from "file-type";
import { promises as fs } from "fs";
import { Hono } from "hono";
import { validator } from "hono/validator";
import path, { join, extname } from "path";
import SuperJSON from "superjson";
import z from "zod";
import { auth } from "../lib/auth";
import { enqueueThumbnail } from "@/services/background-jobs";

const app = new Hono();

fs.mkdir(UPLOAD_DIR, { recursive: true });
fs.mkdir(TEMP_DIR, { recursive: true });

const getPartPath = (id: string) => join(TEMP_DIR, `${id}.part`);
const getFinalPath = (slug: string, originalFilename: string) =>
  join(UPLOAD_DIR, getStoredName(slug, originalFilename));

const registry = new Map<string, UploadMetadata>();

// Helper function to validate all chunks are present
const validateAllChunksReceived = (uploadMeta: UploadMetadata): boolean => {
  if (uploadMeta.chunks.size !== uploadMeta.totalChunks) {
    return false;
  }

  // Check that we have chunks 0 through totalChunks-1
  for (let i = 0; i < uploadMeta.totalChunks; i++) {
    if (!uploadMeta.chunks.has(i)) {
      return false;
    }
  }

  return true;
};

// Helper function to get missing chunks
const getMissingChunks = (uploadMeta: UploadMetadata): number[] => {
  const missing: number[] = [];
  for (let i = 0; i < uploadMeta.totalChunks; i++) {
    if (!uploadMeta.chunks.has(i)) {
      missing.push(i);
    }
  }
  return missing;
};

const initSchema = z.object({
  filename: z.string().min(2).max(255),
  size: z.number().min(1),
});

// Helper function to check if file extension is blacklisted
const isFileExtensionBlacklisted = (filename: string): boolean => {
  if (!SETTINGS.blackListedExtensions) return false;

  try {
    const blacklistedExts: string[] = SuperJSON.parse(
      SETTINGS.blackListedExtensions
    );
    const fileExt = extname(filename).toLowerCase();
    return blacklistedExts.some((ext) => ext.toLowerCase() === fileExt);
  } catch (error) {
    console.error("Error parsing blacklisted extensions:", error);
    return false;
  }
};

// Helper function to check if detected file type extension is blacklisted
const isDetectedFileTypeBlacklisted = (detectedExt: string): boolean => {
  if (!SETTINGS.blackListedExtensions || !detectedExt) return false;

  try {
    const blacklistedExts: string[] = SuperJSON.parse(
      SETTINGS.blackListedExtensions
    );
    const normalizedExt = detectedExt.startsWith(".")
      ? detectedExt.toLowerCase()
      : `.${detectedExt.toLowerCase()}`;
    return blacklistedExts.some((ext) => ext.toLowerCase() === normalizedExt);
  } catch (error) {
    console.error("Error parsing blacklisted extensions:", error);
    return false;
  }
};

// sharex compatible endpoint
app.post(
  "/upload",
  validator("header", async (headers, c) => {
    const apiKey = headers["x-api-key"];

    if (!apiKey) {
      return c.json({ error: "API key is required" }, 401);
    }

    try {
      const [userData] = await db
        .select()
        .from(user)
        .where(eq(user.apiKey, apiKey));

      if (!userData) {
        return c.json({ error: "Invalid API key" }, 401);
      }

      return userData;
    } catch (error) {
      console.error("Database error during API key validation:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }),
  async (c) => {
    try {
      const userData = c.req.valid("header");

      const body = await c.req.parseBody();

      const file = body["file"] as File | null;

      if (!file) {
        return c.json({ error: "No file provided" }, 400);
      }

      if (file.size === 0) {
        return c.json({ error: "File cannot be empty" }, 400);
      }

      // Check if file extension is blacklisted
      if (isFileExtensionBlacklisted(file.name)) {
        const fileExt = extname(file.name);
        return c.json(
          {
            error: `File extension '${fileExt}' is not allowed`,
          },
          400
        );
      }

      if (file.size > 75 * 1024 * 1024) {
        // 75MB
        return c.json({ error: "File size exceeds 75MB limit" }, 400);
      }

      // Check quota (0 means unlimited)
      if (userData.quota > 0) {
        const remainingQuota = userData.quota - userData.usedQuota;
        if (remainingQuota <= 0) {
          return c.json({ error: "Storage quota exceeded" }, 403);
        }

        if (file.size > remainingQuota) {
          return c.json(
            {
              error: "File size exceeds remaining quota",
              remainingQuota,
              fileSize: file.size,
            },
            403
          );
        }
      }

      let fileType;

      try {
        fileType = await fileTypeFromStream(file.stream());
      } catch (error) {
        console.error("Error detecting file type:", error);
        return c.json({ error: "Unable to process file" }, 400);
      }

      if (!fileType) {
        return c.json(
          { error: "Unsupported file type or corrupted file" },
          400
        );
      }

      if (isDetectedFileTypeBlacklisted(fileType.ext)) {
        return c.json(
          {
            error: `File type '${fileType.ext}' is not allowed (detected from file content)`,
          },
          400
        );
      }

      const slug = generateFileSlug();
      const finalPath = getFinalPath(slug, file.name);

      try {
        await Bun.write(finalPath, file);
      } catch (error) {
        console.error("Error writing file to disk:", error);
        return c.json({ error: "Failed to save file" }, 500);
      }

      try {
        const [newFile] = await db
          .insert(files)
          .values({
            id: generateId(),
            key: slug,
            mimeType: fileType.mime,
            originalName: file.name,
            size: file.size,
            userId: userData.id,
          })
          .returning();

        // Tell background service to generate thumbnails/previews
        try {
          await enqueueThumbnail(
            newFile.id,
            getStoredName(slug, file.name),
            newFile.mimeType,
            file.name
          );
        } catch (error) {
          console.error("Failed to enqueue thumbnail to cron service:", error);
          // Don't fail the upload if enqueueing fails
        }

        return c.json({
          success: true,
          fileUrl: `${process.env.BASE_URL}/api/f/${getStoredName(slug, file.name)}`,
        });
      } catch (error) {
        console.error("Database error during file insertion:", error);

        // Clean up uploaded file if database insertion fails
        try {
          await fs.unlink(finalPath);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up file after DB error:",
            cleanupError
          );
        }

        return c.json({ error: "Failed to save file metadata" }, 500);
      }
    } catch (error) {
      console.error("Unexpected error in upload handler:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
);

app.post(
  "/upload/init",
  validator("json", (value, c) => {
    const { data, error } = initSchema.safeParse(value);

    if (error) {
      return c.json(
        {
          error: "Invalid request data",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }

    return data;
  }),
  validator("cookie", async (_, c) => {
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        return c.json({ error: "Authentication required" }, 401);
      }

      return session;
    } catch (error) {
      console.error("Session validation error:", error);
      return c.json({ error: "Authentication failed" }, 401);
    }
  }),
  async (c) => {
    try {
      const {
        session,
        user: { quota, usedQuota },
      } = c.req.valid("cookie");
      const { filename, size } = await c.req.valid("json");

      // Validate file size
      if (size <= 0) {
        return c.json({ error: "File size must be greater than 0" }, 400);
      }

      // Check if file extension is blacklisted
      if (isFileExtensionBlacklisted(filename)) {
        const fileExt = extname(filename);
        return c.json(
          {
            error: `File extension '${fileExt}' is not allowed`,
          },
          400
        );
      }

      if (size > SETTINGS.maxFileSize) {
        return c.json(
          {
            error: `File size exceeds ${formatFileSize(SETTINGS.maxFileSize)} limit`,
          },
          400
        );
      }

      const currentUsedQuota = usedQuota ?? 0;
      const currentQuota = quota ?? 0;

      // Skip quota checks if quota is 0 (unlimited)
      if (currentQuota > 0) {
        const remainingQuota = currentQuota - currentUsedQuota;

        if (remainingQuota <= 0) {
          return c.json(
            {
              error: "Storage quota exceeded",
              usedQuota: currentUsedQuota,
              totalQuota: currentQuota,
            },
            403
          );
        }

        if (size > remainingQuota) {
          return c.json(
            {
              error: "File size exceeds remaining quota",
              fileSize: size,
              remainingQuota,
              usedQuota: currentUsedQuota,
              totalQuota: currentQuota,
            },
            403
          );
        }
      }

      const id = generateId(24);
      const chunkSize = SETTINGS.chunkSize;
      const totalChunks = Math.ceil(size / chunkSize);

      registry.set(id, {
        chunks: new Set<number>(),
        size,
        finished: false,
        filename,
        totalChunks,
        userId: session.userId,
        chunkSize,
      });

      return c.json({
        id,
        chunkSize,
        totalChunks,
        message: "Upload initialized successfully",
      });
    } catch (error) {
      console.error("Upload initialization error:", error);
      return c.json({ error: "Failed to initialize upload" }, 500);
    }
  }
);

app.post(
  "/upload/chunk/:id",
  validator("param", (value, c) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      if (uploadMeta.finished) {
        return c.json({ error: "Upload already completed" }, 400);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload session:", error);
      return c.json({ error: "Failed to validate upload session" }, 500);
    }
  }),
  async (c) => {
    try {
      const { id, uploadMeta } = c.req.valid("param");

      // Validate request headers
      const offsetHeader = c.req.header("x-offset");
      if (!offsetHeader) {
        return c.json({ error: "x-offset header is required" }, 400);
      }

      const offset = parseInt(offsetHeader);
      if (isNaN(offset) || offset < 0) {
        return c.json({ error: "Invalid offset value" }, 400);
      }

      // Get and validate chunk data
      let chunk;
      try {
        chunk = await c.req.arrayBuffer();
      } catch (error) {
        console.error("Error reading chunk data:", error);
        return c.json({ error: "Failed to read chunk data" }, 400);
      }

      if (!chunk || chunk.byteLength === 0) {
        return c.json({ error: "Chunk data cannot be empty" }, 400);
      }

      // Calculate and validate chunk number
      const chunkNumber = Math.floor(offset / uploadMeta.chunkSize);

      if (chunkNumber < 0 || chunkNumber >= uploadMeta.totalChunks) {
        return c.json(
          {
            error: "Invalid chunk number",
            chunkNumber,
            maxChunkNumber: uploadMeta.totalChunks - 1,
          },
          400
        );
      }

      // Check if chunk already uploaded
      if (uploadMeta.chunks.has(chunkNumber)) {
        return c.json({
          message: "Chunk already uploaded",
          chunkNumber,
          uploadedChunks: uploadMeta.chunks.size,
          totalChunks: uploadMeta.totalChunks,
        });
      }

      // Validate chunk size (last chunk may be smaller)
      const expectedSize =
        chunkNumber === uploadMeta.totalChunks - 1
          ? uploadMeta.size % uploadMeta.chunkSize || uploadMeta.chunkSize
          : uploadMeta.chunkSize;

      if (chunk.byteLength > expectedSize) {
        return c.json(
          {
            error: "Chunk size exceeds expected size",
            received: chunk.byteLength,
            expected: expectedSize,
            chunkNumber,
          },
          400
        );
      }

      const partPath = getPartPath(id);

      // Ensure upload directory exists
      const uploadDir = path.dirname(partPath);
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error("Error creating upload directory:", error);
        return c.json({ error: "Failed to prepare upload directory" }, 500);
      }

      // Write chunk to file
      let handle;
      try {
        handle = await fs.open(partPath, "a+");
        await handle.write(Buffer.from(chunk), 0, chunk.byteLength, offset);
        await handle.close();
      } catch (error) {
        console.error("Error writing chunk to file:", error);

        // Clean up file handle if it was opened
        if (handle) {
          try {
            await handle.close();
          } catch {
            // Ignore close errors
          }
        }

        return c.json({ error: "Failed to write chunk to file" }, 500);
      }

      // Track uploaded chunk
      uploadMeta.chunks.add(chunkNumber);

      return c.json({
        status: "ok",
        message: "Chunk uploaded successfully",
        offset,
        chunkNumber,
        chunkLength: chunk.byteLength,
        uploadedChunks: uploadMeta.chunks.size,
        totalChunks: uploadMeta.totalChunks,
        progress: Math.round(
          (uploadMeta.chunks.size / uploadMeta.totalChunks) * 100
        ),
        isComplete: uploadMeta.chunks.size === uploadMeta.totalChunks,
      });
    } catch (error) {
      console.error("Unexpected error in chunk upload:", error);
      return c.json(
        { error: "Internal server error during chunk upload" },
        500
      );
    }
  }
);

app.post(
  "/upload/finish/:id",
  validator("param", async (value, c) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        return c.json({ error: "Authentication required" }, 401);
      }

      if (uploadMeta.userId !== session.user.id) {
        return c.json({ error: "Access denied to this upload session" }, 403);
      }

      return { id, uploadMeta, session };
    } catch (error) {
      console.error("Error validating upload finish request:", error);
      return c.json({ error: "Failed to validate upload session" }, 500);
    }
  }),
  async (c) => {
    try {
      const { id, uploadMeta } = c.req.valid("param");

      // Validate all chunks are received before finishing
      if (!validateAllChunksReceived(uploadMeta)) {
        const missingChunks = getMissingChunks(uploadMeta);
        return c.json(
          {
            error: "Upload incomplete - missing chunks",
            missingChunks,
            receivedChunks: uploadMeta.chunks.size,
            totalChunks: uploadMeta.totalChunks,
            message: "Please upload all missing chunks before finishing",
          },
          400
        );
      }

      const partPath = getPartPath(id);
      const fileSlug = generateFileSlug();
      const finalPath = getFinalPath(fileSlug, uploadMeta.filename);

      // Verify file exists and size matches expected size
      let stats;
      try {
        stats = await fs.stat(partPath);
      } catch (error) {
        console.error("Temporary file not found:", error);
        registry.delete(id);
        return c.json(
          {
            error: "Temporary file not found",
            message: "Upload session has expired or file was corrupted",
          },
          404
        );
      }

      if (stats.size !== uploadMeta.size) {
        // Clean up corrupted temp file
        try {
          await fs.unlink(partPath);
        } catch (cleanupError) {
          console.error("Failed to delete corrupted temp file:", cleanupError);
        }

        registry.delete(id);
        return c.json(
          {
            error: "File size verification failed",
            expected: uploadMeta.size,
            actual: stats.size,
            message: "File appears to be corrupted during upload",
          },
          400
        );
      }

      // Detect file type
      let mimeType;
      let detectedFileType;
      try {
        detectedFileType = await fileTypeFromStream(
          Bun.file(partPath).stream()
        );
        mimeType = detectedFileType?.mime || "application/octet-stream";
      } catch (error) {
        console.error("Error detecting file type:", error);
        mimeType = "application/octet-stream";
      }

      // Check if detected file type extension is blacklisted
      if (
        detectedFileType?.ext &&
        isDetectedFileTypeBlacklisted(detectedFileType.ext)
      ) {
        // Clean up temp file
        try {
          await fs.unlink(partPath);
        } catch (cleanupError) {
          console.error("Failed to delete temp file:", cleanupError);
        }
        registry.delete(id);

        return c.json(
          {
            error: `File type '${detectedFileType.ext}' is not allowed (detected from file content)`,
          },
          400
        );
      }

      const fileId = generateId();
      const actualFilename = getStoredName(fileSlug, uploadMeta.filename);

      try {
        // Perform database transaction
        await db.transaction(async (tx) => {
          await tx.insert(files).values({
            id: fileId,
            key: fileSlug,
            originalName: uploadMeta.filename,
            userId: uploadMeta.userId,
            size: uploadMeta.size,
            mimeType,
          });

          await tx
            .update(user)
            .set({
              usedQuota: sql`${user.usedQuota} + ${uploadMeta.size}`,
            })
            .where(eq(user.id, uploadMeta.userId));
        });

        // If transaction succeeds, move file and clean up
        try {
          await fs.rename(partPath, finalPath);
        } catch (error) {
          console.error("Error moving file to final location:", error);

          // Try to rollback database changes
          try {
            await db.transaction(async (tx) => {
              await tx.delete(files).where(eq(files.id, fileId));
              await tx
                .update(user)
                .set({
                  usedQuota: sql`${user.usedQuota} - ${uploadMeta.size}`,
                })
                .where(eq(user.id, uploadMeta.userId));
            });
          } catch (rollbackError) {
            console.error(
              "Failed to rollback database changes:",
              rollbackError
            );
          }

          return c.json({ error: "Failed to finalize file upload" }, 500);
        }

        registry.delete(id);

        let thumbnailQueued = false;
        if (isSupportedFileType(mimeType)) {
          try {
            await enqueueThumbnail(
              fileId,
              actualFilename,
              mimeType,
              uploadMeta.filename
            );
            thumbnailQueued = true;
          } catch (error) {
            console.error("Failed to queue thumbnail generation:", error);
            // Don't fail the upload if thumbnail queueing fails
          }
        }

        return c.json({
          status: "complete",
          fileId,
          fileKey: fileSlug,
          actualFilename,
          size: uploadMeta.size,
          mimeType,
          supportsThumbnails: isSupportedFileType(mimeType),
          thumbnailQueued,
          message: isSupportedFileType(mimeType)
            ? thumbnailQueued
              ? "Upload complete. Thumbnail generation queued."
              : "Upload complete. Thumbnail generation failed to queue."
            : "Upload complete.",
        });
      } catch (error) {
        console.error("Database transaction failed:", error);

        // Clean up temp file on database failure
        try {
          await fs.unlink(partPath);
        } catch (cleanupError) {
          console.error(
            "Failed to delete temp file after DB error:",
            cleanupError
          );
        }

        registry.delete(id);
        return c.json(
          {
            error: "Failed to save file metadata",
            message: "Database operation failed during upload completion",
          },
          500
        );
      }
    } catch (error) {
      console.error("Unexpected error in upload finish:", error);

      // Clean up registry entry on any unexpected error
      const { id } = c.req.valid("param");
      if (id) {
        registry.delete(id);
      }

      return c.json(
        { error: "Internal server error during upload completion" },
        500
      );
    }
  }
);

app.get(
  "/upload/status/:id",
  validator("param", (value, c) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload status request:", error);
      return c.json({ error: "Failed to validate upload session" }, 500);
    }
  }),
  async (c) => {
    try {
      const { id, uploadMeta } = c.req.valid("param");

      const missingChunks = getMissingChunks(uploadMeta);
      const isComplete = validateAllChunksReceived(uploadMeta);
      const progress = Math.round(
        (uploadMeta.chunks.size / uploadMeta.totalChunks) * 100
      );

      return c.json({
        id,
        filename: uploadMeta.filename,
        size: uploadMeta.size,
        chunkSize: uploadMeta.chunkSize,
        totalChunks: uploadMeta.totalChunks,
        receivedChunks: uploadMeta.chunks.size,
        missingChunks,
        isComplete,
        finished: uploadMeta.finished,
        progress,
        canResume: !uploadMeta.finished && uploadMeta.chunks.size > 0,
        status: uploadMeta.finished
          ? "completed"
          : isComplete
            ? "ready-to-finish"
            : uploadMeta.chunks.size > 0
              ? "in-progress"
              : "initialized",
        message: uploadMeta.finished
          ? "Upload completed successfully"
          : isComplete
            ? "All chunks received, ready to finish upload"
            : uploadMeta.chunks.size > 0
              ? `Upload in progress: ${uploadMeta.chunks.size}/${uploadMeta.totalChunks} chunks received`
              : "Upload initialized, waiting for chunks",
      });
    } catch (error) {
      console.error("Error getting upload status:", error);
      return c.json({ error: "Failed to get upload status" }, 500);
    }
  }
);

app.delete(
  "/upload/cancel/:id",
  validator("param", async (value, c) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        return c.json({ error: "Authentication required" }, 401);
      }

      if (uploadMeta.userId !== session.user.id) {
        return c.json({ error: "Access denied to this upload session" }, 403);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload cancel request:", error);
      return c.json({ error: "Failed to validate upload session" }, 500);
    }
  }),
  async (c) => {
    try {
      const { id, uploadMeta } = c.req.valid("param");

      const partPath = getPartPath(id);
      let fileCleanedUp = false;

      // Clean up temp file if it exists
      try {
        await fs.unlink(partPath);
        fileCleanedUp = true;
      } catch (cleanupError) {
        // File might not exist, which is fine for cancellation
        const errorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : "Unknown error";
        console.log(
          "Temp file cleanup during cancellation (file may not exist):",
          errorMessage
        );
      }

      // Remove from registry
      registry.delete(id);

      return c.json({
        status: "cancelled",
        id,
        filename: uploadMeta.filename,
        chunksUploaded: uploadMeta.chunks.size,
        totalChunks: uploadMeta.totalChunks,
        fileCleanedUp,
        message: "Upload cancelled successfully and temporary files cleaned up",
      });
    } catch (error) {
      console.error("Error cancelling upload:", error);

      // Still try to clean up registry even if there was an error
      const { id } = c.req.valid("param");

      if (id) {
        registry.delete(id);
      }

      return c.json({ error: "Failed to cancel upload properly" }, 500);
    }
  }
);

export default app;
