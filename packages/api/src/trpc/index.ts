import { router } from "./init";
import { adminRouter } from "./routes/admin";
import { cronRouter } from "./routes/cron";
import { filesRouter } from "./routes/files";
import { jobsRouter } from "./routes/jobs";
import { settingsRouter } from "./routes/settings";
import { metricsRouter } from "./routes/metrics";

export const appRouter = router({
  settings: settingsRouter,
  files: filesRouter,
  admin: adminRouter,
  cron: cronRouter,
  jobs: jobsRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
