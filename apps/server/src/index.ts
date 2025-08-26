import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import SuperJSON from "superjson";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { SETTINGS } from "./lib/settings";
import "./lib/setup";
import file from "./routes/file";
import upload from "./routes/upload";
import { appRouter } from "./trpc";

const app = new Hono().basePath("/api");

app.use(logger());
app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		endpoint: "/api/trpc",
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));
app.route("/", upload);
app.route("/", file);
app.get("/settings", (c) =>
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
	fetch: app.fetch,
};
