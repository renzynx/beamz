import type { UploadMetadata } from "@beam/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { promises as fs } from "node:fs";
import { getPartPath, registry } from "../helpers/uploadHelpers";

const app = new Hono();

app.post(
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

      if (uploadMeta.finished) {
        return c.json({ error: "Upload already completed" }, 400);
      }

      return { id, uploadMeta };
    } catch (error) {
      console.error("Error validating upload session:", error);
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

      // Validate request headers
      const offsetHeader = c.req.header("x-offset");
      if (!offsetHeader) {
        return c.json({ error: "x-offset header is required" }, 400);
      }

      const offset = Number.parseInt(offsetHeader, 10);
      if (Number.isNaN(offset) || offset < 0) {
        return c.json({ error: "Invalid offset value" }, 400);
      }

      // Get and validate chunk data
      let chunk: ArrayBuffer;

      try {
        chunk = await c.req.arrayBuffer();
      } catch (error) {
        console.error("Error reading chunk data:", error);
        return c.json({ error: "Failed to read chunk data" }, 400);
      }

      if (!chunk || chunk.byteLength === 0) {
        return c.json({ error: "Chunk data cannot be empty" }, 400);
      }

      // Calculate and validate chunk number
      const chunkNumber = Math.floor(offset / uploadMeta.chunkSize);

      if (chunkNumber < 0 || chunkNumber >= uploadMeta.totalChunks) {
        return c.json(
          {
            error: "Invalid chunk number",
            chunkNumber,
            maxChunkNumber: uploadMeta.totalChunks - 1,
          },
          400,
        );
      }

      // Check if chunk already uploaded
      if (uploadMeta.chunks.has(chunkNumber)) {
        return c.json({
          message: "Chunk already uploaded",
          chunkNumber,
          uploadedChunks: uploadMeta.chunks.size,
          totalChunks: uploadMeta.totalChunks,
        });
      }

      // Validate chunk size (last chunk may be smaller)
      const expectedSize =
        chunkNumber === uploadMeta.totalChunks - 1
          ? uploadMeta.size % uploadMeta.chunkSize || uploadMeta.chunkSize
          : uploadMeta.chunkSize;

      if (chunk.byteLength > expectedSize) {
        return c.json(
          {
            error: "Chunk size exceeds expected size",
            received: chunk.byteLength,
            expected: expectedSize,
            chunkNumber,
          },
          400,
        );
      }

      const partPath = getPartPath(id);

      // Write chunk to file
      let handle: any;

      try {
        handle = await fs.open(partPath, "a+");
        await handle.write(Buffer.from(chunk), 0, chunk.byteLength, offset);
        await handle.close();
      } catch (error) {
        console.error("Error writing chunk to file:", error);

        // Clean up file handle if it was opened
        if (handle) {
          try {
            await handle.close();
          } catch {
            // Ignore close errors
          }
        }

        return c.json({ error: "Failed to write chunk to file" }, 500);
      }

      // Track uploaded chunk
      uploadMeta.chunks.add(chunkNumber);

      return c.json({
        status: "ok",
        message: "Chunk uploaded successfully",
        offset,
        chunkNumber,
        chunkLength: chunk.byteLength,
        uploadedChunks: uploadMeta.chunks.size,
        totalChunks: uploadMeta.totalChunks,
        progress: Math.round(
          (uploadMeta.chunks.size / uploadMeta.totalChunks) * 100,
        ),
        isComplete: uploadMeta.chunks.size === uploadMeta.totalChunks,
      });
    } catch (error) {
      console.error("Unexpected error in chunk upload:", error);
      return c.json(
        { error: "Internal server error during chunk upload" },
        500,
      );
    }
  },
);

export default app;
