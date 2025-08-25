import "./lib/queue";
import { CronService } from "./cron-service";

const cronService = new CronService();

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  cronService.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  cronService.stop();
  process.exit(0);
});

(async () => {
  try {
    await cronService.start();
    console.log("Cron service is running...");
    console.log("Status:", JSON.stringify(cronService.getStatus(), null, 2));
  } catch (error) {
    console.error("Failed to start background jobs service:", error);
    process.exit(1);
  }
})();

export default cronService;
