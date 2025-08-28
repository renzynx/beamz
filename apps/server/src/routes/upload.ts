import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";
import { except } from "hono/combine";
import cancelApp from "./handlers/cancelUpload";
import finishApp from "./handlers/finishUpload";
import initApp from "./handlers/initUpload";
import statusApp from "./handlers/statusUpload";
import chunkApp from "./handlers/uploadChunk";
import uploadShareX from "./handlers/uploadShareX";

const app = new Hono();

app.use(
  "/upload/*",
  except(
    "/upload/chunk",
    rateLimiter({
      windowMs: 60 * 1000,
      limit: 60,
      keyGenerator: (c) =>
        c.req.header("x-forwarded-for") ||
        getConnInfo(c).remote.address ||
        "unknown",
    }),
  ),
);

app.route("/upload", uploadShareX);
app.route("/upload/init", initApp);
app.route("/upload/chunk", chunkApp);
app.route("/upload/finish", finishApp);
app.route("/upload/status", statusApp);
app.route("/upload/cancel", cancelApp);

export default app;
