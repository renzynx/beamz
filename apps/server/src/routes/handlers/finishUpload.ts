import { auth } from "@/lib/auth";
import { isSupportedFileType } from "@/lib/thumbnail";
import type { UploadMetadata } from "@/lib/types";
import { getStoredName } from "@/lib/utils";
import {
  enqueueDiskCleanup,
  enqueueThumbnail,
} from "@/services/background-jobs";
import { db, eq, files, sql, user } from "@beam/database";
import { generateId } from "better-auth";
import { fileTypeFromStream, type FileTypeResult } from "file-type";
import type { Context } from "hono";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { promises as fs, type Stats } from "node:fs";
import {
  getFinalPath,
  getMissingChunks,
  getPartPath,
  isDetectedFileTypeBlacklisted,
  registry,
  validateAllChunksReceived,
} from "../helpers/uploadHelpers";

const app = new Hono();

app.post(
  "/:id",
  validator("param", async (value, c: Context) => {
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
  async (c: Context) => {
    try {
      const id = c.req.param("id") as string;
      const uploadMeta = registry.get(id) as UploadMetadata | undefined;

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

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
          400,
        );
      }

      const partPath = getPartPath(id);
      const fileSlug = generateId(11);
      const finalPath = getFinalPath(fileSlug, uploadMeta.filename);

      let stats: Stats;

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
          404,
        );
      }

      if (stats.size !== uploadMeta.size) {
        // Clean up corrupted temp file
        await enqueueDiskCleanup([partPath]);

        registry.delete(id);
        return c.json(
          {
            error: "File size verification failed",
            expected: uploadMeta.size,
            actual: stats.size,
            message: "File appears to be corrupted during upload",
          },
          400,
        );
      }

      // Detect file type
      let mimeType: string;
      let detectedFileType: FileTypeResult | undefined;

      try {
        detectedFileType = await fileTypeFromStream(
          Bun.file(partPath).stream(),
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
        await enqueueDiskCleanup([partPath]);
        registry.delete(id);

        return c.json(
          {
            error: `File type '${detectedFileType.ext}' is not allowed (detected from file content)`,
          },
          400,
        );
      }

      // Check user quota BEFORE saving metadata and moving file
      try {
        const dbUserRes = await db
          .select()
          .from(user)
          .where(eq(user.id, uploadMeta.userId))
          .limit(1);

        const dbUser = dbUserRes[0];

        if (!dbUser) {
          await enqueueDiskCleanup([partPath]);
          registry.delete(id);
          return c.json({ error: "User not found" }, 404);
        }

        if (dbUser.quota > 0) {
          const remainingQuota = dbUser.quota - dbUser.usedQuota;

          if (remainingQuota <= 0) {
            await enqueueDiskCleanup([partPath]);
            registry.delete(id);
            return c.json({ error: "Storage quota exceeded" }, 403);
          }

          if (uploadMeta.size > remainingQuota) {
            await enqueueDiskCleanup([partPath]);
            registry.delete(id);
            return c.json(
              {
                error: "File size exceeds remaining quota",
                remainingQuota,
              },
              403,
            );
          }
        }
      } catch (error) {
        console.error("Failed to verify user quota:", error);
        await enqueueDiskCleanup([partPath]);
        registry.delete(id);
        return c.json({ error: "Failed to verify quota" }, 500);
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
              rollbackError,
            );
          }

          return c.json({ error: "Failed to finalize file upload" }, 500);
        }

        registry.delete(id);

        let _thumbnailQueued = false;
        if (isSupportedFileType(mimeType)) {
          try {
            await enqueueThumbnail(
              fileId,
              actualFilename,
              mimeType,
              uploadMeta.filename,
            );
            _thumbnailQueued = true;
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
        });
      } catch (error) {
        console.error("Database transaction failed:", error);

        // Clean up temp file on database failure
        await enqueueDiskCleanup([partPath]);

        registry.delete(id);
        return c.json(
          {
            error: "Failed to save file metadata",
            message: "Database operation failed during upload completion",
          },
          500,
        );
      }
    } catch (error) {
      console.error("Unexpected error in upload finish:", error);

      // Clean up registry entry on any unexpected error
      const id = c.req.param("id");
      if (id) {
        registry.delete(id);
      }

      return c.json(
        { error: "Internal server error during upload completion" },
        500,
      );
    }
  },
);

export default app;
