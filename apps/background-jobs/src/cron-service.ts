import type { CronStatus, LogLevel } from "@beam/shared";
import dotenv from "dotenv";
import { JobScheduler } from "./lib/job-scheduler";
import { Logger } from "./lib/logger";
import { SettingsManager } from "./lib/settings-manager";

// Load environment variables
dotenv.config();

export class CronService {
  private logger: Logger;
  private settingsManager: SettingsManager;
  private jobScheduler: JobScheduler;

  constructor() {
    this.logger = new Logger();

    this.settingsManager = new SettingsManager(this.logger);
    this.jobScheduler = new JobScheduler(this.logger, this.settingsManager);
  }

  public async loadSettings(): Promise<void> {
    const cronSettings = await this.settingsManager.loadSettings();
    this.logger.setLevel(cronSettings.logLevel as LogLevel);

    const cronEnabled = await this.settingsManager.isCronEnabled();

    if (this.settingsManager.hasSettingsChanged()) {
      this.logger.info("Settings changed detected, restarting cron jobs");
      await this.restart();
      return;
    }

    if (!cronEnabled) {
      this.logger.warn("Cron jobs are disabled in database settings");
      if (this.jobScheduler.isJobsRunning()) {
        this.stopJobsOnly();
      }
      return;
    }

    this.logger.info("Settings loaded successfully");
  }

  public async restart() {
    this.logger.info("Restarting cron service due to settings change");

    // Stop current jobs but keep control server running
    this.jobScheduler.stop();

    // Reload settings and start jobs again
    await this.loadSettings();

    const cronEnabled = await this.settingsManager.isCronEnabled();
    if (cronEnabled) {
      await this.startJobs();
    } else {
      this.logger.info("Cron disabled after restart - jobs will not start");
    }
  }

  private async startJobs() {
    const cronSettings = await this.settingsManager.loadSettings();
    const cronEnabled = await this.settingsManager.isCronEnabled();

    if (!cronEnabled) {
      this.logger.warn("Cannot start jobs - cron is disabled in settings");
      return;
    }

    await this.jobScheduler.start(cronSettings);
  }

  public async start() {
    // Load settings from database first
    await this.loadSettings();

    const cronEnabled = await this.settingsManager.isCronEnabled();

    if (!cronEnabled) {
      this.logger.warn(
        "Cron service disabled - settings indicate cron is disabled",
      );

      return;
    }

    // Start the jobs
    await this.startJobs();
  }

  public async startJobsOnly() {
    const cronSettings = this.settingsManager.getCurrentSettings();
    if (!cronSettings) {
      await this.loadSettings();
    }

    const cronEnabled = await this.settingsManager.isCronEnabled();

    if (!cronEnabled) {
      throw new Error("Cannot start cron jobs - cron is disabled in settings");
    }

    if (this.jobScheduler.isJobsRunning()) {
      throw new Error("Cron jobs are already running");
    }

    await this.startJobs();
  }

  public stopJobsOnly() {
    this.logger.info(
      "Stopping cron jobs only (keeping control server running)",
    );
    this.jobScheduler.stop();
  }

  public stop() {
    this.logger.info("Stopping cron service");
    this.jobScheduler.stop();
  }

  public getStatus(): CronStatus {
    return {
      cleanupJob: this.jobScheduler.getCleanupJobStatus(),
      tempCleanupJob: this.jobScheduler.getTempCleanupJobStatus(),
    };
  }
}
