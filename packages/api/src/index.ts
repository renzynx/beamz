import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { auth } from "./lib/auth";
import "./lib/setup";
import file from "./routes/file";
import upload from "./routes/upload";
import { appRouter } from "./trpc";
import { SETTINGS } from "./lib/settings";
import SuperJSON from "superjson";
import { UPLOAD_DIR } from "./lib/constants";

const app = new Hono();

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/api/trpc",
    createContext: ({ req }) => ({ headers: req.headers }),
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api", upload);
app.route("/api", file);
app.get("/api/settings", (c) =>
  c.json({
    appName: SETTINGS.appName,
    enableSignUp: SETTINGS.enableSignUp,
    chunkSize: SETTINGS.chunkSize,
    maxFileSize: SETTINGS.maxFileSize,
    blackListedExtensions: SETTINGS.blackListedExtensions
      ? SuperJSON.parse(SETTINGS.blackListedExtensions)
      : [],
  })
);

export default {
  port: process.env.PORT || 3333,
  fetch: app.fetch,
};
