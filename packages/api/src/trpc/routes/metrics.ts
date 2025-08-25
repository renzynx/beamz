import z from "zod";
import { adminProcedure, router } from "../init";
import { db, files, jobs, user, count, sql, sum } from "@beam/db";

const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 hours
type CacheEntry = { ts: number; data: z.infer<typeof metricsOutputSchema> };

const metricsCache = new Map<string, CacheEntry>();

export const uploadsPerDaySchema = z.object({
  day: z.string(),
  total: z.number(),
});

export const jobsByStatusSchema = z.object({
  status: z.string(),
  total: z.number(),
});

export const usersByRoleSchema = z.object({
  role: z.string().nullable(),
  total: z.number(),
});

export const signupsPerDaySchema = z.object({
  day: z.string(),
  total: z.number(),
});

export const metricsOutputSchema = z.object({
  totalFiles: z.number(),
  totalJobs: z.number(),
  totalUsers: z.number(),
  totalStorageBytes: z.number(),
  jobsByStatus: z.array(jobsByStatusSchema),
  uploadsPerDay: z.array(uploadsPerDaySchema),
  usersByRole: z.array(usersByRoleSchema),
  signupsPerDay: z.array(signupsPerDaySchema),
});

export const metricsRouter = router({
  overview: adminProcedure
    .input(z.object({ days: z.number().min(1).optional().default(7) }))
    .output(metricsOutputSchema)
    .query(async ({ input }) => {
      const { days } = input;

      // Check cache
      const cacheKey = JSON.stringify({ days });
      const cached = metricsCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.ts < CACHE_TTL_MS) {
        return cached.data;
      }

      // total files
      const totalFilesRes = await db.select({ total: count() }).from(files);
      const totalFiles = totalFilesRes[0]?.total ?? 0;

      // total jobs
      const totalJobsRes = await db.select({ total: count() }).from(jobs);
      const totalJobs = totalJobsRes[0]?.total ?? 0;

      // total users
      const totalUsersRes = await db.select({ total: count() }).from(user);
      const totalUsers = totalUsersRes[0]?.total ?? 0;

      // total storage from database
      const totalStorageRes = await db
        .select({ total: sum(files.size) })
        .from(files);
      const totalStorageBytes = Number(totalStorageRes[0]?.total ?? 0);

      // jobs by status
      const jobsByStatusRows = await db
        .select({ status: jobs.status, total: count() })
        .from(jobs)
        .groupBy(jobs.status);

      const jobsByStatus = jobsByStatusRows.map((r) => ({
        status: r.status,
        total: Number(r.total),
      }));

      // uploads per day (last `days` days)
      const uploadsRows = await db
        .select({
          day: sql<string>`date(${files.createdAt} / 1000, 'unixepoch')`,
          total: count(),
        })
        .from(files)
        .where(
          sql`${files.createdAt} >= ${Date.now() - days * 24 * 60 * 60 * 1000}`
        )
        .groupBy(sql`date(${files.createdAt} / 1000, 'unixepoch')`)
        .orderBy(sql`date(${files.createdAt} / 1000, 'unixepoch') desc`);

      const uploadsPerDay = uploadsRows.map((r) => ({
        day: r.day,
        total: Number(r.total),
      }));

      // users by role
      const usersByRoleRows = await db
        .select({ role: user.role, total: count() })
        .from(user)
        .groupBy(user.role);

      const usersByRole = usersByRoleRows.map((r) => ({
        role: r.role,
        total: Number(r.total),
      }));

      // signups per day (last `days` days)
      const signupsRows = await db
        .select({
          day: sql<string>`date(${user.createdAt} / 1000, 'unixepoch')`,
          total: count(),
        })
        .from(user)
        .where(
          sql`${user.createdAt} >= ${Date.now() - days * 24 * 60 * 60 * 1000}`
        )
        .groupBy(sql`date(${user.createdAt} / 1000, 'unixepoch')`)
        .orderBy(sql`date(${user.createdAt} / 1000, 'unixepoch') desc`);

      const signupsPerDay = signupsRows.map((r) => ({
        day: r.day,
        total: Number(r.total),
      }));

      const result = {
        totalFiles,
        totalJobs,
        totalUsers,
        totalStorageBytes,
        jobsByStatus,
        uploadsPerDay,
        usersByRole,
        signupsPerDay,
      };

      metricsCache.set(cacheKey, {
        ts: now,
        data: result,
      });

      return result;
    }),
  revalidate: adminProcedure
    .input(z.object({ days: z.array(z.number()).optional() }).optional())
    .mutation(async ({ input }) => {
      // If no input or no days provided, clear all cache
      if (!input || !input.days || input.days.length === 0) {
        const cleared = metricsCache.size;
        metricsCache.clear();
        return { success: true, cleared } as const;
      }

      // Delete specific cache entries for provided days
      let cleared = 0;
      for (const d of input.days) {
        const key = JSON.stringify({ days: d });
        if (metricsCache.delete(key)) cleared++;
      }

      return { success: true, cleared } as const;
    }),
});
