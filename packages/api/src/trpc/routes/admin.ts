import z from "zod";
import { adminProcedure, router } from "../init";
import { db, user } from "@beam/db";
import { asc, desc, count } from "@beam/db";

// Output schema for users
export const userItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  role: z.string().nullable(),
  banned: z.boolean().nullable(),
  banReason: z.string().nullable(),
  banExpires: z.date().nullable(),
  quota: z.number(),
  usedQuota: z.number(),
});

export const usersOutputSchema = z.object({
  data: z.array(userItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

// Cron status schema
export const cronStatusSchema = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  cleanupJob: z.object({
    running: z.boolean(),
    schedule: z.string(),
  }),
  tempCleanupJob: z.object({
    running: z.boolean(),
    schedule: z.string(),
  }),
  lastSettingsCheck: z.string().optional(),
  controlServerRunning: z.boolean(),
});

export const cronRestartResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});

export const adminRouter = router({
  getUsers: adminProcedure
    .input(
      z.object({
        offset: z.number().min(0).optional().default(0),
        limit: z.number().min(1).max(100).optional().default(20),
        sortBy: z
          .enum([
            "createdAt",
            "updatedAt",
            "name",
            "email",
            "usedQuota",
            "quota",
          ])
          .optional()
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      })
    )
    .output(usersOutputSchema)
    .query(async ({ input }) => {
      const { offset, limit, sortBy, sortDir } = input;

      const totalRes = await db.select({ total: count() }).from(user);

      const total = totalRes[0]?.total ?? 0;

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          banExpires: user.banExpires,
          quota: user.quota,
          usedQuota: user.usedQuota,
        })
        .from(user)
        .orderBy(() => {
          if (sortDir === "asc") return asc(user[sortBy]);
          return desc(user[sortBy]);
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

  // jobs endpoints moved to routes/jobs.ts
});
