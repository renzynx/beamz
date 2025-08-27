import type { Context } from "hono";
import { Hono } from "hono";
import { validator } from "hono/validator";
import type { UploadMetadata } from "@/lib/types";
import {
  getMissingChunks,
  registry,
  validateAllChunksReceived,
} from "../helpers/uploadHelpers";

const app = new Hono();

app.get(
  "/:id",
  validator("param", (value, c: Context) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload status request:", error);
      return c.json({ error: "Failed to validate upload session" }, 500);
    }
  }),
  async (c: Context) => {
    try {
      const id = c.req.param("id") as string;
      const uploadMeta = registry.get(id) as UploadMetadata | undefined;

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      const missingChunks = getMissingChunks(uploadMeta);
      const isComplete = validateAllChunksReceived(uploadMeta);
      const progress = Math.round(
        (uploadMeta.chunks.size / uploadMeta.totalChunks) * 100,
      );

      return c.json({
        id,
        filename: uploadMeta.filename,
        size: uploadMeta.size,
        chunkSize: uploadMeta.chunkSize,
        totalChunks: uploadMeta.totalChunks,
        receivedChunks: uploadMeta.chunks.size,
        missingChunks,
        isComplete,
        finished: uploadMeta.finished,
        progress,
        canResume: !uploadMeta.finished && uploadMeta.chunks.size > 0,
        status: uploadMeta.finished
          ? "completed"
          : isComplete
            ? "ready-to-finish"
            : uploadMeta.chunks.size > 0
              ? "in-progress"
              : "initialized",
        message: uploadMeta.finished
          ? "Upload completed successfully"
          : isComplete
            ? "All chunks received, ready to finish upload"
            : uploadMeta.chunks.size > 0
              ? `Upload in progress: ${uploadMeta.chunks.size}/${uploadMeta.totalChunks} chunks received`
              : "Upload initialized, waiting for chunks",
      });
    } catch (error) {
      console.error("Error getting upload status:", error);
      return c.json({ error: "Failed to get upload status" }, 500);
    }
  },
);

export default app;
