import dotenv from "dotenv";
import type { CronStatus, LogLevel } from "./lib/types";
import { Logger } from "./lib/logger";
import { SimpleHttpServer } from "./lib/http-server";
import { SettingsManager } from "./lib/settings-manager";
import { JobScheduler } from "./lib/job-scheduler";
import { queueThumbnailGeneration, queueDiskCleanup } from "./lib/queue";
import { isSupportedFileType } from "./lib/thumbnail";

// Load environment variables
dotenv.config();

export class CronService {
  private logger: Logger;
  private httpServer: SimpleHttpServer;
  private settingsManager: SettingsManager;
  private jobScheduler: JobScheduler;
  private settingsWatcher?: NodeJS.Timeout;

  constructor() {
    this.logger = new Logger();

    const apiBaseUrl = process.env.BASE_URL || "http://localhost:3333";
    const controlPort = parseInt(process.env.CRON_CONTROL_PORT || "3335");

    this.httpServer = new SimpleHttpServer({ port: controlPort });
    this.settingsManager = new SettingsManager(this.logger);
    this.jobScheduler = new JobScheduler(this.logger, this.settingsManager);

    this.setupRoutes();
  }

  private setupRoutes() {
    // Health check endpoint
    this.httpServer.get("/health", async () => {
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          cron: this.getStatus(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    // Restart endpoint
    this.httpServer.post("/restart", async () => {
      try {
        await this.restart();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Cron service restarted successfully",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    });

    // Force reload settings endpoint
    this.httpServer.post("/reload-settings", async () => {
      try {
        await this.loadSettings();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Settings reloaded successfully",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    });

    // Start cron service endpoint
    this.httpServer.post("/start", async () => {
      try {
        const status = this.getStatus();
        const isRunning =
          status.cleanupJob.running || status.tempCleanupJob.running;

        if (isRunning) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Cron service is already running",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        await this.startJobsOnly();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Cron service started successfully",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    });

    // Stop cron service endpoint
    this.httpServer.post("/stop", async () => {
      try {
        const status = this.getStatus();
        const isRunning =
          status.cleanupJob.running || status.tempCleanupJob.running;

        if (!isRunning) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Cron service is not running",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        this.stopJobsOnly();
        return new Response(
          JSON.stringify({
            success: true,
            message: "Cron service stopped successfully",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    });

    // Enqueue thumbnail generation for supported file types
    this.httpServer.post("/enqueue/thumbnail", async (request) => {
      try {
        const body = await request.json();
        const { fileId, actualFilename, mimeType, originalName } = body || {};

        if (!fileId || !actualFilename || !mimeType) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing required fields",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!isSupportedFileType(mimeType)) {
          return new Response(
            JSON.stringify({ success: false, error: "Unsupported file type" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const jobId = await queueThumbnailGeneration(
          fileId,
          actualFilename,
          mimeType,
          originalName || ""
        );

        return new Response(
          JSON.stringify({
            success: true,
            jobId,
            message: "Thumbnail enqueued",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    });

    // Enqueue disk cleanup job
    this.httpServer.post("/enqueue/disk-cleanup", async (request) => {
      try {
        const body = await request.json();
        const { filePaths, description } = body || {};

        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "filePaths must be a non-empty array",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        await queueDiskCleanup(filePaths, description || "manual cleanup");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Disk cleanup enqueued",
            count: filePaths.length,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    });
  }

  private async loadSettings(): Promise<void> {
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

  private startSettingsWatcher() {
    const watchInterval = parseInt(
      process.env.SETTINGS_WATCH_INTERVAL || "30000"
    );

    this.settingsWatcher = setInterval(async () => {
      try {
        await this.loadSettings();
      } catch (error) {
        this.logger.error("Failed to check settings during watch", { error });
      }
    }, watchInterval);

    this.logger.info(
      `Settings watcher started (checking every ${watchInterval}ms)`
    );
  }

  private stopSettingsWatcher() {
    if (this.settingsWatcher) {
      clearInterval(this.settingsWatcher);
      this.settingsWatcher = undefined;
      this.logger.info("Settings watcher stopped");
    }
  }

  private async restart() {
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
        "Cron service disabled - settings indicate cron is disabled"
      );
      // Still start the settings watcher to detect when it gets enabled
      this.startSettingsWatcher();
      // Start control server even when cron is disabled for management
      await this.httpServer.start();
      this.logger.info(
        `Control server started on port ${this.httpServer.getPort()}`
      );
      return;
    }

    // Start the jobs
    await this.startJobs();

    // Start watching for settings changes
    this.startSettingsWatcher();

    // Start the control server for management endpoints
    await this.httpServer.start();
    this.logger.info(
      `Control server started on port ${this.httpServer.getPort()}`
    );
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
      "Stopping cron jobs only (keeping control server running)"
    );
    this.jobScheduler.stop();
  }

  public stop() {
    this.logger.info("Stopping cron service");
    this.jobScheduler.stop();
    this.stopSettingsWatcher();
    this.httpServer.stop();
  }

  public getStatus(): CronStatus {
    return {
      cleanupJob: this.jobScheduler.getCleanupJobStatus(),
      tempCleanupJob: this.jobScheduler.getTempCleanupJobStatus(),
      settingsWatcher: {
        running: !!this.settingsWatcher,
        interval: process.env.SETTINGS_WATCH_INTERVAL || "30000",
      },
    };
  }
}
