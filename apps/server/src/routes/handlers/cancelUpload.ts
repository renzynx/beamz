import { promises as fs } from "node:fs";
import type { Context } from "hono";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { auth } from "@/lib/auth";
import type { UploadMetadata } from "@/lib/types";
import { getPartPath, registry } from "../helpers/uploadHelpers";

const app = new Hono();

app.delete(
  "/:id",
  validator("param", async (value, c: Context) => {
    const { id } = value;

    if (!id) {
      return c.json({ error: "Upload ID is required" }, 400);
    }

    try {
      const uploadMeta = registry.get(id);

      if (!uploadMeta) {
        return c.json({ error: "Upload session not found" }, 404);
      }

      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        return c.json({ error: "Authentication required" }, 401);
      }

      if (uploadMeta.userId !== session.user.id) {
        return c.json({ error: "Access denied to this upload session" }, 403);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload cancel request:", error);
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

      const partPath = getPartPath(id);
      let fileCleanedUp = false;

      // Clean up temp file if it exists
      try {
        await fs.unlink(partPath);
        fileCleanedUp = true;
      } catch (cleanupError) {
        // File might not exist, which is fine for cancellation
        const errorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : "Unknown error";
        console.log(
          "Temp file cleanup during cancellation (file may not exist):",
          errorMessage,
        );
      }

      // Remove from registry
      registry.delete(id);

      return c.json({
        status: "cancelled",
        id,
        filename: uploadMeta.filename,
        chunksUploaded: uploadMeta.chunks.size,
        totalChunks: uploadMeta.totalChunks,
        fileCleanedUp,
        message: "Upload cancelled successfully and temporary files cleaned up",
      });
    } catch (error) {
      console.error("Error cancelling upload:", error);

      // Still try to clean up registry even if there was an error
      const id = c.req.param("id");

      if (id) {
        registry.delete(id);
      }

      return c.json({ error: "Failed to cancel upload properly" }, 500);
    }
  },
);

export default app;
