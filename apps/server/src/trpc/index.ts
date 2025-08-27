import { router } from "../lib/trpc";
import { adminRouter } from "./routers/admin";
import { cronRouter } from "./routers/cron";
import { filesRouter } from "./routers/files";
import { jobsRouter } from "./routers/jobs";
import { metricsRouter } from "./routers/metrics";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
  settings: settingsRouter,
  files: filesRouter,
  admin: adminRouter,
  cron: cronRouter,
  jobs: jobsRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
