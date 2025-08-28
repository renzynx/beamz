import { SETTINGS } from "@/lib/settings";
import { adminProcedure, router } from "@/lib/trpc";
import {
  cronHealth,
  cronReloadSettings,
  cronRestart,
  cronStart,
  cronStop,
} from "@/services/background-jobs";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const cronStatusSchema = z.object({
  enabled: z.boolean(),
  running: z.boolean(),
  completedJobsJob: z.object({ running: z.boolean(), schedule: z.string() }),
  expiredFilesJob: z.object({ running: z.boolean(), schedule: z.string() }),
  tempCleanupJob: z.object({ running: z.boolean(), schedule: z.string() }),
  lastSettingsCheck: z.string().optional(),
  controlServerRunning: z.boolean(),
});

export const cronRestartResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});

export const cronRouter = router({
  cronStatus: adminProcedure.output(cronStatusSchema).query(async () => {
    try {
      const status = await cronHealth();

      const cronData = status.cron || {};
      const lastSettingsCheck = (cronData as any).settingsWatcher?.interval;
      const isRunning =
        !!cronData.cleanupJob?.running || !!cronData.tempCleanupJob?.running;

      const cleanupJob = cronData.cleanupJob || undefined;

      const completedSchedule =
        cleanupJob?.schedule ||
        SETTINGS.completedJobsCleanupSchedule ||
        "unknown";
      const expiredSchedule =
        SETTINGS.expiredFilesCleanupSchedule ||
        cleanupJob?.schedule ||
        "unknown";
      const tempSchedule =
        cronData.tempCleanupJob?.schedule ||
        SETTINGS.tempCleanupSchedule ||
        "unknown";

      return {
        enabled: SETTINGS.cronEnabled || false,
        running: isRunning,
        completedJobsJob: {
          running: !!cleanupJob?.running,
          schedule: completedSchedule,
        },
        expiredFilesJob: {
          running: !!cleanupJob?.running,
          schedule: expiredSchedule,
        },
        tempCleanupJob: cronData.tempCleanupJob || {
          running: false,
          schedule: tempSchedule,
        },
        lastSettingsCheck,
        controlServerRunning: true,
      };
    } catch (error) {
      console.error("Failed to get cron status:", error);
      return {
        enabled: SETTINGS.cronEnabled || false,
        running: false,
        completedJobsJob: {
          running: false,
          schedule: SETTINGS.completedJobsCleanupSchedule || "unknown",
        },
        expiredFilesJob: {
          running: false,
          schedule: SETTINGS.expiredFilesCleanupSchedule || "unknown",
        },
        tempCleanupJob: {
          running: false,
          schedule: SETTINGS.tempCleanupSchedule || "unknown",
        },
        controlServerRunning: false,
      };
    }
  }),

  cronRestart: adminProcedure
    .output(cronRestartResponseSchema)
    .mutation(async () => {
      try {
        await cronRestart();

        return {
          success: true,
          message: "Cron service restarted successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to restart cron service:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to restart cron service. Make sure the cron service is running and accessible.",
        });
      }
    }),

  cronReloadSettings: adminProcedure
    .output(cronRestartResponseSchema)
    .mutation(async () => {
      try {
        await cronReloadSettings();

        return {
          success: true,
          message: "Cron settings reloaded successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to reload cron settings:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to reload cron settings. Make sure the cron service is running and accessible.",
        });
      }
    }),

  cronStart: adminProcedure
    .output(cronRestartResponseSchema)
    .mutation(async () => {
      try {
        await cronStart();

        return {
          success: true,
          message: "Cron service started successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to start cron service:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to start cron service. Make sure the cron control server is running and accessible.",
        });
      }
    }),

  cronStop: adminProcedure
    .output(cronRestartResponseSchema)
    .mutation(async () => {
      try {
        await cronStop();

        return {
          success: true,
          message: "Cron service stopped successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Failed to stop cron service:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to stop cron service. Make sure the cron service is running and accessible.",
        });
      }
    }),
});
