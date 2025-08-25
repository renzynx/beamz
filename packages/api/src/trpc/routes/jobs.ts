import z from "zod";
import { adminProcedure, router } from "../init";
import { db, jobs, and, eq, lte, asc, desc, count, inArray } from "@beam/db";
import { TRPCError } from "@trpc/server";

export const jobItemSchema = z.object({
  id: z.string(),
  queue: z.string(),
  payload: z.string(),
  status: z.string(),
  attempts: z.number(),
  maxAttempts: z.number(),
  error: z.string().nullable(),
  createdAt: z.date().nullable(),
  processAt: z.date().nullable(),
  processedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
});

export const jobsOutputSchema = z.object({
  data: z.array(jobItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const jobsRouter = router({
  listJobs: adminProcedure
    .input(
      z.object({
        offset: z.number().min(0).optional().default(0),
        limit: z.number().min(1).max(100).optional().default(20),
        sortBy: z
          .enum(["createdAt", "completedAt", "status", "queue"])
          .optional()
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
        status: z.string().optional(),
        queue: z.string().optional(),
      })
    )
    .output(jobsOutputSchema)
    .query(async ({ input }) => {
      const { offset, limit, sortBy, sortDir, status, queue } = input;

      const whereClauses: any[] = [];
      if (status) whereClauses.push(eq(jobs.status, status));
      if (queue) whereClauses.push(eq(jobs.queue, queue));

      const totalRes = whereClauses.length
        ? await db
            .select({ total: count() })
            .from(jobs)
            .where(and(...whereClauses))
        : await db.select({ total: count() }).from(jobs);

      const total = totalRes[0]?.total ?? 0;

      const rows = await db
        .select({
          id: jobs.id,
          queue: jobs.queue,
          payload: jobs.payload,
          status: jobs.status,
          attempts: jobs.attempts,
          maxAttempts: jobs.maxAttempts,
          error: jobs.error,
          createdAt: jobs.createdAt,
          processAt: jobs.processAt,
          processedAt: jobs.processedAt,
          completedAt: jobs.completedAt,
        })
        .from(jobs)
        .where(() => (whereClauses.length ? and(...whereClauses) : undefined))
        .orderBy(() => {
          // map sortBy to the jobs table column
          const col = (jobs as any)[sortBy] ?? jobs.createdAt;
          return sortDir === "asc" ? asc(col) : desc(col);
        })
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

  cleanup: adminProcedure
    .input(
      z.object({
        olderThanDays: z.number().min(1).optional().default(7),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const cutoffDate = new Date(
          Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000
        );

        const deletedJobs = await db
          .delete(jobs)
          .where(
            and(eq(jobs.status, "completed"), lte(jobs.completedAt, cutoffDate))
          )
          .returning({ id: jobs.id });

        return {
          success: true,
          message: "Manual jobs cleanup completed successfully",
          deletedJobs,
          timestamp: new Date().toISOString(),
          note: "Temp file cleanup is handled automatically by the cron service",
        };
      } catch (error) {
        console.error("Manual jobs cleanup failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Jobs cleanup operation failed",
        });
      }
    }),

  bulkDelete: adminProcedure
    .input(z.object({ jobIds: z.array(z.string()).min(1) }))
    .mutation(async ({ input }) => {
      try {
        const { jobIds } = input;

        // Delete the specified jobs and return their ids
        const deleted = await db
          .delete(jobs)
          .where(inArray(jobs.id, jobIds))
          .returning({ id: jobs.id });

        return {
          success: true,
          message: `Deleted ${deleted.length} job(s)`,
          deletedCount: deleted.length,
          deletedIds: deleted.map((d) => d.id),
        };
      } catch (error) {
        console.error("Bulk job delete failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Bulk job delete operation failed",
        });
      }
    }),
});
