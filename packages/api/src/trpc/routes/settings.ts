import z from "zod";
import { adminProcedure, publicProcedure, router } from "../init";
import { db, settings, eq } from "@beam/db";
import { SETTINGS } from "@/lib/settings";
import SuperJSON from "superjson";

const dbSettingSchema = z.object({
  appName: z.string().min(1),
  cdnUrl: z.string().min(1).nullable(),
  enableSignUp: z.boolean(),
  chunkSize: z.number().int().min(1024),
  maxFileSize: z.number().int().min(1024),
  blackListedExtensions: z.string().optional().nullable(),
  completedJobsCleanupSchedule: z.string().optional().nullable(),
  expiredFilesCleanupSchedule: z.string().optional().nullable(),
  tempCleanupSchedule: z.string().optional().nullable(),
  cronEnabled: z.boolean().optional(),
  cronLogLevel: z.string().optional().nullable(),
  cronTimezone: z.string().optional().nullable(),
});

const settingSchema = dbSettingSchema.extend({
  blackListedExtensions: z
    .union([z.string(), z.array(z.string()), z.null(), z.undefined()])
    .transform((val) => {
      if (typeof val === "string") {
        try {
          return SuperJSON.parse(val);
        } catch {
          return [] as string[];
        }
      }
      if (Array.isArray(val)) return val;
      return [] as string[];
    }),
});

const settingInputSchema = dbSettingSchema.partial().extend({
  blackListedExtensions: z
    .array(z.string())
    .optional()
    .transform((val) =>
      val === undefined ? undefined : SuperJSON.stringify(val)
    ),
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
        cdnUrl: true,
      })
    )
    .query(() => ({
      appName: SETTINGS.appName,
      enableSignUp: SETTINGS.enableSignUp,
      chunkSize: SETTINGS.chunkSize,
      maxFileSize: SETTINGS.maxFileSize,
      cdnUrl: SETTINGS.cdnUrl,
      blackListedExtensions: SETTINGS.blackListedExtensions
        ? SuperJSON.parse(SETTINGS.blackListedExtensions)
        : [],
    })),
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
