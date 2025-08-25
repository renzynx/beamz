import { db, eq, files, user, sql } from "@beam/db";
import { generateId } from "better-auth";
import { fileTypeFromStream } from "file-type";
import { promises as fs } from "fs";
import path, { extname } from "path";
import { validator } from "hono/validator";
import { isSupportedFileType } from "@/lib/thumbnail";
import { getStoredName, generateFileSlug } from "@/lib/utils";
import { enqueueThumbnail } from "@/services/background-jobs";
import {
  isFileExtensionBlacklisted,
  isDetectedFileTypeBlacklisted,
  getFinalPath,
} from "../helpers/uploadHelpers";
import type { Context } from "hono";
import { Hono } from "hono";

const app = new Hono();

app.post(
  "/",
  validator("header", async (headers, c: Context) => {
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
  async (c: Context) => {
    try {
      const userData = (c.req as any).valid("header");

      const body = await (c.req as any).parseBody();

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
        // Insert file and increment user's usedQuota atomically
        const result = await db.transaction(async (tx) => {
          const [inserted] = await tx
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

          await tx
            .update(user)
            .set({
              usedQuota: sql`${user.usedQuota} + ${file.size}`,
            })
            .where(eq(user.id, userData.id));

          return inserted;
        });

        const newFile = result;

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
          fileUrl: `${process.env.BASE_URL}/f/${getStoredName(slug, file.name)}`,
          thumbnailUrl: isSupportedFileType(newFile.mimeType)
            ? `${process.env.BASE_URL}/f/${getStoredName(slug, file.name, "thumbnail")}`
            : null,
        });
      } catch (error) {
        console.error("Database error during file insertion:", error);

        // Clean up uploaded file if database transaction fails
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

export default app;
