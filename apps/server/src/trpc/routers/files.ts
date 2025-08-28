import { protectedProcedure, router } from "@/lib/trpc";
import { getStoredName } from "@/lib/utils";
import {
  enqueueDiskCleanup,
  enqueueThumbnail,
} from "@/services/background-jobs";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  files,
  inArray,
  sql,
  user,
} from "@beam/database";
import type { FileMetadata } from "@beam/shared";
import { UPLOAD_DIR } from "@beam/shared/constants";
import { TRPCError } from "@trpc/server";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import superjson from "superjson";
import z from "zod";

export const fileItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  originalName: z.string(),
  size: z.number(),
  mimeType: z.string(),
  metadata: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});

export const filesOutputSchema = z.object({
  data: z.array(fileItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const filesRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        offset: z.number().min(0).optional().default(0),
        limit: z.number().min(1).max(100).optional().default(20),
        sortBy: z
          .enum(["createdAt", "originalName", "size", "mimeType"])
          .optional()
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      }),
    )
    .output(filesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { offset, limit, sortBy, sortDir } = input;

      const whereConditions = [eq(files.userId, ctx.session.user.id)];

      const totalRes = await db
        .select({ total: count() })
        .from(files)
        .where(and(...whereConditions));

      const total = totalRes[0]?.total ?? 0;

      const rows = await db
        .select({
          id: files.id,
          key: files.key,
          originalName: files.originalName,
          size: files.size,
          mimeType: files.mimeType,
          metadata: files.metadata,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
        })
        .from(files)
        .where(and(...whereConditions))
        .orderBy(sortDir === "asc" ? asc(files[sortBy]) : desc(files[sortBy]))
        .limit(limit)
        .offset(offset);

      const hasNext = offset + rows.length < total;

      return {
        data: rows,
        total,
        offset,
        limit,
        hasNextPage: hasNext,
        hasPreviousPage: offset > 0,
      };
    }),

  regenerateThumbnail: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { fileId } }) => {
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(eq(files.id, fileId), eq(files.userId, ctx.session.user.id)),
        );

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found or access denied",
        });
      }

      const filePath = join(
        UPLOAD_DIR,
        getStoredName(file.key, file.originalName),
      );

      try {
        await fs.access(filePath);
      } catch {
        await db.transaction(async (tx) => {
          const deletedFile = await tx
            .delete(files)
            .where(eq(files.id, file.id))
            .returning({ size: files.size });

          if (deletedFile[0]) {
            await tx
              .update(user)
              .set({
                usedQuota: sql`MAX(0, ${user.usedQuota} - ${deletedFile[0].size})`,
              })
              .where(eq(user.id, ctx.session.user.id));
          }
        });

        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original file not found on disk",
        });
      }

      await enqueueThumbnail(
        file.id,
        getStoredName(file.key, file.originalName),
        file.mimeType,
      );

      return {
        success: true,
        message:
          "Thumbnail regeneration has been queued and will be processed shortly",
      };
    }),

  delete: protectedProcedure
    .input(z.object({ fileIds: z.array(z.string()).min(1) }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        deletedCount: z.number(),
        failedCount: z.number(),
      }),
    )
    .mutation(async ({ ctx, input: { fileIds } }) => {
      // Fetch all files belonging to the user
      const userFiles = await db
        .select()
        .from(files)
        .where(
          and(
            inArray(files.id, fileIds),
            eq(files.userId, ctx.session.user.id),
          ),
        );

      if (userFiles.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No files found or access denied",
        });
      }

      const failedCount = fileIds.length - userFiles.length;

      // Collect all file paths that need to be deleted
      const allFilesToDelete: string[] = [];
      let totalSizeToFree = 0;

      for (const file of userFiles) {
        totalSizeToFree += file.size;

        // Parse metadata to get file paths
        const metadata = file.metadata
          ? superjson.parse<FileMetadata>(file.metadata)
          : null;

        // Main file
        const mainFilePath = join(
          UPLOAD_DIR,
          getStoredName(file.key, file.originalName),
        );
        allFilesToDelete.push(mainFilePath);

        // Thumbnail file
        if (metadata?.thumbnail) {
          allFilesToDelete.push(join(UPLOAD_DIR, metadata.thumbnail));
        }

        // Preview file
        if (metadata?.preview) {
          allFilesToDelete.push(join(UPLOAD_DIR, metadata.preview));
        }
      }

      await db.transaction(async (tx) => {
        // Delete all files
        await tx.delete(files).where(
          and(
            inArray(
              files.id,
              userFiles.map((f) => f.id),
            ),
            eq(files.userId, ctx.session.user.id),
          ),
        );

        // Update user quota
        if (totalSizeToFree > 0) {
          await tx
            .update(user)
            .set({
              usedQuota: sql`MAX(0, ${user.usedQuota} - ${totalSizeToFree})`,
            })
            .where(eq(user.id, ctx.session.user.id));
        }
      });

      if (allFilesToDelete.length > 0) {
        try {
          await enqueueDiskCleanup(
            allFilesToDelete,
            `Bulk deletion of ${userFiles.length} files for user ${ctx.session.user.id}`,
          );
        } catch (error) {
          console.error("Failed to queue disk cleanup:", error);
          // Don't fail the operation if disk cleanup queueing fails
        }
      }

      return {
        success: true,
        message: `Successfully deleted ${userFiles.length} file(s)${
          failedCount > 0
            ? `, ${failedCount} file(s) not found or access denied`
            : ""
        }.`,
        deletedCount: userFiles.length,
        failedCount,
      };
    }),
});
