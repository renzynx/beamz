import { Hono } from "hono";
import { CronService } from "./cron-service";
import { Logger } from "./lib/logger";
import "./lib/queue";
import { queueDiskCleanup, queueThumbnailGeneration } from "./lib/queue";
import { isSupportedFileType } from "./lib/thumbnail";

// Create cron service instance
const logger = new Logger();
const cronService = new CronService();

// Create the main Hono app
const app = new Hono()
  .get("/health", (c) => {
    const response = {
      status: "ok",
      timestamp: new Date().toISOString(),
      cron: cronService.getStatus(),
    };

    return c.json(response);
  })
  .post("/restart", async (c) => {
    try {
      await cronService.restart();

      const response = {
        success: true,
        message: "Cron service restarted successfully",
        timestamp: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return c.json(response, 500);
    }
  })
  .post("/reload-settings", async (c) => {
    try {
      await cronService.loadSettings();

      const response = {
        success: true,
        message: "Settings reloaded successfully",
        timestamp: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return c.json(response, 500);
    }
  })
  .post("/start", async (c) => {
    try {
      const status = cronService.getStatus();
      const isRunning =
        status.cleanupJob.running || status.tempCleanupJob.running;

      if (isRunning) {
        const response = {
          success: false,
          error: "Cron service is already running",
        };

        return c.json(response, 400);
      }

      await cronService.startJobsOnly();

      const response = {
        success: true,
        message: "Cron service started successfully",
        timestamp: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return c.json(response, 500);
    }
  })
  .post("/stop", async (c) => {
    try {
      const status = cronService.getStatus();
      const isRunning =
        status.cleanupJob.running || status.tempCleanupJob.running;

      if (!isRunning) {
        const response = {
          success: false,
          error: "Cron service is not running",
        };

        return c.json(response, 400);
      }

      cronService.stopJobsOnly();

      const response = {
        success: true,
        message: "Cron service stopped successfully",
        timestamp: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return c.json(errorResponse, 500);
    }
  })
  .post("/enqueue/thumbnail", async (c) => {
    try {
      const body = await c.req.json();
      const { fileId, actualFilename, mimeType } = body;

      if (!isSupportedFileType(mimeType)) {
        const response = {
          success: false,
          error: "Unsupported file type",
        };

        return c.json(response, 400);
      }

      const jobId = await queueThumbnailGeneration(
        fileId,
        actualFilename,
        mimeType,
      );

      const response = {
        success: true,
        jobId,
        message: "Thumbnail enqueued",
      };

      return c.json(response);
    } catch (error) {
      const response = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      return c.json(response, 500);
    }
  })
  .post("/enqueue/disk-cleanup", async (c) => {
    try {
      const body = await c.req.json();
      const { filePaths, description } = body;

      await queueDiskCleanup(filePaths, description || "manual cleanup");

      const response = {
        success: true,
        message: "Disk cleanup enqueued",
        count: filePaths.length,
      };

      return c.json(response);
    } catch (error) {
      const response = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      return c.json(response, 500);
    }
  });

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  cronService.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  cronService.stop();
  process.exit(0);
});

// Start the service
(async () => {
  try {
    await cronService.start();
    logger.info("Background jobs service started successfully");
  } catch (error) {
    logger.error("Failed to start background jobs service:", error);
    process.exit(1);
  }
})();

export default {
  port: process.env.CRON_CONTROL_PORT || 3335,
  fetch: app.fetch,
};

export type AppType = typeof app;
