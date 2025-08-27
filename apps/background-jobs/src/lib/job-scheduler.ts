import * as cron from "node-cron";
import { cleanupExpiredFiles, cleanupOrphanedTempFiles } from "./files";
import { cleanupCompletedJobs } from "./jobs";
import type { Logger } from "./logger";
import type { SettingsManager } from "./settings-manager";
import type { CronSettings } from "./types";

export class JobScheduler {
  private expiredFilesTask?: cron.ScheduledTask;
  private completedJobsTask?: cron.ScheduledTask;
  private tempCleanupTask?: cron.ScheduledTask;
  private isRunning = false;
  private logger: Logger;
  private settingsManager: SettingsManager;

  constructor(logger: Logger, settingsManager: SettingsManager) {
    this.logger = logger;
    this.settingsManager = settingsManager;
  }

  async start(cronSettings: CronSettings) {
    this.logger.info("Starting cron jobs", {
      cleanupSchedule: cronSettings.completedJobsCleanupSchedule,
      tempCleanupSchedule: cronSettings.tempCleanupSchedule,
    });

    // Use safe defaults when provided schedules are invalid
    const DEFAULT_JOB_CLEANUP_SCHEDULE = "0 2 * * *"; // daily at 2 AM
    const DEFAULT_TEMP_CLEANUP_SCHEDULE = "*/30 * * * *"; // every 30 minutes
    const DEFAULT_TIMEZONE = "UTC";

    let jobSchedule =
      cronSettings.completedJobsCleanupSchedule || DEFAULT_JOB_CLEANUP_SCHEDULE;
    if (!cron.validate(jobSchedule)) {
      this.logger.info(
        `Invalid completedJobsCleanupSchedule '${cronSettings.completedJobsCleanupSchedule}', falling back to default '${DEFAULT_JOB_CLEANUP_SCHEDULE}'`,
      );
      jobSchedule = DEFAULT_JOB_CLEANUP_SCHEDULE;
    }

    let tempSchedule =
      cronSettings.tempCleanupSchedule || DEFAULT_TEMP_CLEANUP_SCHEDULE;
    if (!cron.validate(tempSchedule)) {
      this.logger.info(
        `Invalid tempCleanupSchedule '${cronSettings.tempCleanupSchedule}', falling back to default '${DEFAULT_TEMP_CLEANUP_SCHEDULE}'`,
      );
      tempSchedule = DEFAULT_TEMP_CLEANUP_SCHEDULE;
    }

    const timezone = cronSettings.timezone || DEFAULT_TIMEZONE;

    // Task: enqueue expired files for deletion (DB-driven)
    this.expiredFilesTask = cron.schedule(
      jobSchedule,
      async () => {
        try {
          await cleanupExpiredFiles();
        } catch (err) {
          this.logger.error("Error enqueuing expired files for deletion", err);
        }
      },
      {
        timezone,
      },
    );

    // Task: cleanup completed jobs
    this.completedJobsTask = cron.schedule(
      jobSchedule,
      async () => {
        try {
          await cleanupCompletedJobs();
        } catch (err) {
          this.logger.error("Error cleaning up completed jobs", err);
        }
      },
      {
        timezone,
      },
    );

    this.tempCleanupTask = cron.schedule(
      tempSchedule,
      () => cleanupOrphanedTempFiles(),
      {
        timezone,
      },
    );

    // Start the tasks
    this.expiredFilesTask?.start();
    this.completedJobsTask?.start();
    this.tempCleanupTask.start();
    this.isRunning = true;

    this.logger.info("Cron jobs started successfully");
  }

  stop() {
    this.logger.info("Stopping cron jobs");

    if (this.expiredFilesTask) {
      this.expiredFilesTask.stop();
      this.expiredFilesTask.destroy();
      this.expiredFilesTask = undefined;
      this.logger.info("Expired files job stopped");
    }

    if (this.completedJobsTask) {
      this.completedJobsTask.stop();
      this.completedJobsTask.destroy();
      this.completedJobsTask = undefined;
      this.logger.info("Completed jobs cleanup stopped");
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
    return (
      this.isRunning &&
      (!!this.expiredFilesTask ||
        !!this.completedJobsTask ||
        !!this.tempCleanupTask)
    );
  }

  getCleanupJobStatus(): { running: boolean; schedule: string } {
    const cronSettings = this.settingsManager.getCurrentSettings();
    return {
      running:
        this.isRunning && (!!this.expiredFilesTask || !!this.completedJobsTask),
      schedule: cronSettings?.completedJobsCleanupSchedule || "unknown",
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
