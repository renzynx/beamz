import { Hono } from "hono";
import cancelApp from "./handlers/cancelUpload";
import finishApp from "./handlers/finishUpload";
import initApp from "./handlers/initUpload";
import statusApp from "./handlers/statusUpload";
import chunkApp from "./handlers/uploadChunk";
import uploadApp from "./handlers/uploadShareX";

const app = new Hono();

app.route("/upload", uploadApp);
app.route("/upload/init", initApp);
app.route("/upload/chunk", chunkApp);
app.route("/upload/finish", finishApp);
app.route("/upload/status", statusApp);
app.route("/upload/cancel", cancelApp);

export default app;
