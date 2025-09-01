import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";
import { every } from "hono/combine";
import SuperJSON from "superjson";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { SETTINGS } from "./lib/settings";
import "./lib/setup";
import upload from "./routes/upload";
import { appRouter } from "./trpc";

const app = new Hono().basePath("/api");

const rateLimit = rateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (c) =>
    // Prefer the first IP in X-Forwarded-For when present
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    getConnInfo(c).remote.address ||
    "unknown",
});

app.use(
  "/trpc/*",
  every(
    rateLimit,
    trpcServer({
      router: appRouter,
      endpoint: "/api/trpc",
      createContext: (_opts, context) => {
        return createContext({ context });
      },
    }),
  ),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route("/", upload);
app.use(rateLimit).get("/settings", (c) =>
  c.json({
    appName: SETTINGS.appName,
    enableSignUp: SETTINGS.enableSignUp,
    chunkSize: SETTINGS.chunkSize,
    maxFileSize: SETTINGS.maxFileSize,
    blackListedExtensions: SETTINGS.blackListedExtensions
      ? SuperJSON.parse(SETTINGS.blackListedExtensions)
      : [],
  }),
);

export default {
  port: process.env.API_PORT || 3333,
  fetch: app.fetch
};
