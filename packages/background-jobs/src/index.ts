import "./lib/queue";
import { CronService } from "./cron-service";
import { Logger } from "./lib/logger";

const logger = new Logger();

const cronService = new CronService();

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

(async () => {
  try {
    await cronService.start();
  } catch (error) {
    logger.error("Failed to start background jobs service:", error);
    process.exit(1);
  }
})();

export default cronService;
