import z from "zod";
import { adminProcedure, router } from "../init";
import { SETTINGS } from "@/lib/settings";
import {
  cronHealth,
  cronRestart,
  cronReloadSettings,
  cronStart,
  cronStop,
} from "@/services/background-jobs";
import { TRPCError } from "@trpc/server";

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

export const cronRouter = router({
  cronStatus: adminProcedure.output(cronStatusSchema).query(async () => {
    try {
      const status = await cronHealth();

      const cronData = status.cron || {};
      const isRunning =
        cronData.cleanupJob?.running ||
        false ||
        cronData.tempCleanupJob?.running ||
        false;

      return {
        enabled: SETTINGS.cronEnabled || false,
        running: isRunning,
        cleanupJob: cronData.cleanupJob || {
          running: false,
          schedule: "unknown",
        },
        tempCleanupJob: cronData.tempCleanupJob || {
          running: false,
          schedule: "unknown",
        },
        lastSettingsCheck: cronData.lastSettingsCheck,
        controlServerRunning: true,
      };
    } catch (error) {
      console.error("Failed to get cron status:", error);
      return {
        enabled: SETTINGS.cronEnabled || false,
        running: false,
        cleanupJob: { running: false, schedule: "unknown" },
        tempCleanupJob: { running: false, schedule: "unknown" },
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
