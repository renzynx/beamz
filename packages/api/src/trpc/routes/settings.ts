import z from "zod";
import { adminProcedure, publicProcedure, router } from "../init";
import { db, settings, eq } from "@beam/db";
import { SETTINGS } from "@/lib/settings";
import SuperJSON from "superjson";

const settingSchema = z.object({
  appName: z.string().min(1),
  enableSignUp: z.boolean(),
  chunkSize: z.number().int().min(1024),
  maxFileSize: z.number().int().min(1024),
  blackListedExtensions: z.array(z.string()).optional().nullable(),
  // Cron settings
  jobCleanupSchedule: z.string().optional().nullable(),
  tempCleanupSchedule: z.string().optional().nullable(),
  cronEnabled: z.boolean().optional(),
  cronLogLevel: z.string().optional().nullable(),
  cronTimezone: z.string().optional().nullable(),
});

const settingInputSchema = z.object({
  appName: z.string().min(1).optional(),
  enableSignUp: z.boolean().optional(),
  chunkSize: z.number().int().min(1024).optional(),
  maxFileSize: z.number().int().min(1024).optional(),
  blackListedExtensions: z
    .array(z.string())
    .optional()
    .nullable()
    .transform((val) => SuperJSON.stringify(val || [])),
  // Cron settings
  jobCleanupSchedule: z.string().optional(),
  tempCleanupSchedule: z.string().optional(),
  cronEnabled: z.boolean().optional(),
  cronLogLevel: z.string().optional(),
  cronTimezone: z.string().optional(),
  cronSecret: z.string().optional(),
});

export const settingsRouter = router({
  public: publicProcedure
    .output(
      settingSchema.pick({
        appName: true,
        enableSignUp: true,
        chunkSize: true,
        maxFileSize: true,
        blackListedExtensions: true,
      })
    )
    .query(() => {
      return {
        appName: SETTINGS.appName,
        enableSignUp: SETTINGS.enableSignUp,
        chunkSize: SETTINGS.chunkSize,
        maxFileSize: SETTINGS.maxFileSize,
        blackListedExtensions: SETTINGS.blackListedExtensions
          ? SuperJSON.parse(SETTINGS.blackListedExtensions)
          : [],
      };
    }),
  get: adminProcedure.output(settingSchema).query(() => ({
    ...SETTINGS,
    blackListedExtensions: SETTINGS.blackListedExtensions
      ? SuperJSON.parse(SETTINGS.blackListedExtensions)
      : [],
  })),
  set: adminProcedure.input(settingInputSchema).mutation(async ({ input }) => {
    const newSettings = await db
      .update(settings)
      .set(input)
      .where(eq(settings.id, SETTINGS.id))
      .returning();

    Object.assign(SETTINGS, newSettings[0]);

    return {
      ...newSettings[0],
      blackListedExtensions: newSettings[0].blackListedExtensions
        ? SuperJSON.parse(newSettings[0].blackListedExtensions)
        : [],
    };
  }),
});
