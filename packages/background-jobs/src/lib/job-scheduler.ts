import * as cron from "node-cron";
import type { CronSettings } from "./types";
import { Logger } from "./logger";
import { ApiClient } from "./api-client";
import { SettingsManager } from "./settings-manager";

export class JobScheduler {
  private cleanupTask?: cron.ScheduledTask;
  private tempCleanupTask?: cron.ScheduledTask;
  private isRunning: boolean = false;
  private logger: Logger;
  private apiClient: ApiClient;
  private settingsManager: SettingsManager;

  constructor(
    logger: Logger,
    apiClient: ApiClient,
    settingsManager: SettingsManager
  ) {
    this.logger = logger;
    this.apiClient = apiClient;
    this.settingsManager = settingsManager;
  }

  private async cleanupUploads() {
    this.logger.info("Starting uploads cleanup");

    const result = await this.apiClient.cleanupUploads();

    if (result.success) {
      this.logger.info("Uploads cleanup completed successfully", result.data);
    } else {
      this.logger.error("Uploads cleanup failed", { error: result.error });
    }
  }

  private async cleanupTempFiles() {
    this.logger.info("Starting temp files cleanup");

    const result = await this.apiClient.cleanupTempFiles();

    if (result.success) {
      this.logger.info(
        "Temp files cleanup completed successfully",
        result.data
      );
    } else {
      this.logger.error("Temp files cleanup failed", { error: result.error });
    }
  }

  async start(cronSettings: CronSettings) {
    this.logger.info("Starting cron jobs", {
      cleanupSchedule: cronSettings.jobCleanupSchedule,
      tempCleanupSchedule: cronSettings.tempCleanupSchedule,
    });

    // Validate cron schedules
    if (!cron.validate(cronSettings.jobCleanupSchedule)) {
      throw new Error(
        `Invalid cleanup cron schedule: ${cronSettings.jobCleanupSchedule}`
      );
    }

    if (!cron.validate(cronSettings.tempCleanupSchedule)) {
      throw new Error(
        `Invalid temp cleanup cron schedule: ${cronSettings.tempCleanupSchedule}`
      );
    }

    // Main cleanup job (uploads, old files, etc.)
    this.cleanupTask = cron.schedule(
      cronSettings.jobCleanupSchedule,
      () => this.cleanupUploads(),
      {
        timezone: cronSettings.timezone,
      }
    );

    // Temp files cleanup job (more frequent)
    this.tempCleanupTask = cron.schedule(
      cronSettings.tempCleanupSchedule,
      () => this.cleanupTempFiles(),
      {
        timezone: cronSettings.timezone,
      }
    );

    // Start the tasks
    this.cleanupTask.start();
    this.tempCleanupTask.start();
    this.isRunning = true;

    this.logger.info("Cron jobs started successfully");
  }

  stop() {
    this.logger.info("Stopping cron jobs");

    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask.destroy();
      this.cleanupTask = undefined;
      this.logger.info("Cleanup job stopped");
    }

    if (this.tempCleanupTask) {
      this.tempCleanupTask.stop();
      this.tempCleanupTask.destroy();
      this.tempCleanupTask = undefined;
      this.logger.info("Temp cleanup job stopped");
    }

    this.isRunning = false;
  }

  isJobsRunning(): boolean {
    return this.isRunning && (!!this.cleanupTask || !!this.tempCleanupTask);
  }

  getCleanupJobStatus(): { running: boolean; schedule: string } {
    const cronSettings = this.settingsManager.getCurrentSettings();
    return {
      running: this.isRunning && !!this.cleanupTask,
      schedule: cronSettings?.jobCleanupSchedule || "unknown",
    };
  }

  getTempCleanupJobStatus(): { running: boolean; schedule: string } {
    const cronSettings = this.settingsManager.getCurrentSettings();
    return {
      running: this.isRunning && !!this.tempCleanupTask,
      schedule: cronSettings?.tempCleanupSchedule || "unknown",
    };
  }
}
