import { db, settings } from "@beam/db";
import type { CronSettings } from "./types";
import { Logger } from "./logger";

export class SettingsManager {
  private cronSettings?: CronSettings;
  private lastSettingsHash?: string;
  private settingsChanged: boolean = false;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadSettings(): Promise<CronSettings> {
    try {
      // Load settings from database
      const settingsData = await db.select().from(settings).limit(1);
      const dbSettings = settingsData[0];

      // Create a hash of relevant settings to detect changes
      const settingsHash = JSON.stringify({
        jobCleanupSchedule: dbSettings?.jobCleanupSchedule,
        tempCleanupSchedule: dbSettings?.tempCleanupSchedule,
        cronLogLevel: dbSettings?.cronLogLevel,
        cronTimezone: dbSettings?.cronTimezone,
        cronEnabled: dbSettings?.cronEnabled,
      });

      // Check if settings have changed
      const settingsChanged =
        this.lastSettingsHash !== undefined &&
        this.lastSettingsHash !== settingsHash;
      this.lastSettingsHash = settingsHash;
      this.settingsChanged = !!settingsChanged;

      // Merge database settings with environment variable fallbacks
      this.cronSettings = {
        jobCleanupSchedule:
          dbSettings?.jobCleanupSchedule ||
          process.env.JOB_CLEANUP_SCHEDULE ||
          "0 2 * * *", // Daily at 2 AM
        tempCleanupSchedule:
          dbSettings?.tempCleanupSchedule ||
          process.env.TEMP_CLEANUP_SCHEDULE ||
          "*/30 * * * *", // Every 30 minutes
        logLevel: dbSettings?.cronLogLevel || process.env.LOG_LEVEL || "info",
        timezone: dbSettings?.cronTimezone || process.env.TIMEZONE || "UTC",
      };

      this.logger.info("Settings loaded from database", {
        logLevel: this.cronSettings.logLevel,
        cleanupSchedule: this.cronSettings.jobCleanupSchedule,
        tempCleanupSchedule: this.cronSettings.tempCleanupSchedule,
        timezone: this.cronSettings.timezone,
        settingsChanged: this.settingsChanged,
      });

      return this.cronSettings;
    } catch (error) {
      this.logger.error(
        "Failed to load settings from database, using defaults",
        { error }
      );

      // Fallback to environment variables only
      this.cronSettings = {
        jobCleanupSchedule: process.env.JOB_CLEANUP_SCHEDULE || "0 2 * * *",
        tempCleanupSchedule:
          process.env.TEMP_CLEANUP_SCHEDULE || "*/30 * * * *",
        logLevel: process.env.LOG_LEVEL || "info",
        timezone: process.env.TIMEZONE || "UTC",
      };

      return this.cronSettings;
    }
  }

  async isCronEnabled(): Promise<boolean> {
    try {
      const settingsData = await db.select().from(settings).limit(1);
      const dbSettings = settingsData[0];
      return dbSettings?.cronEnabled ?? true;
    } catch (error) {
      this.logger.error("Failed to check if cron is enabled", { error });
      return true; // Default to enabled if we can't check
    }
  }

  hasSettingsChanged(): boolean {
    const changed = this.settingsChanged;
    // consume the flag so subsequent calls don't trigger repeated restarts
    this.settingsChanged = false;
    return changed;
  }

  getCurrentSettings(): CronSettings | undefined {
    return this.cronSettings;
  }
}
