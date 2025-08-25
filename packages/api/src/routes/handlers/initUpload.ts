import { generateId } from "better-auth";
import { validator } from "hono/validator";
import { SETTINGS } from "@/lib/settings";
import { formatFileSize } from "@/lib/utils";
import {
  initSchema,
  registry,
  isFileExtensionBlacklisted,
} from "../helpers/uploadHelpers";
import path from "path";
import { auth } from "@/lib/auth";
import { Hono } from "hono";

const app = new Hono();

app.post(
  "/",
  validator("json", (value, c) => {
    const { data, error } = initSchema.safeParse(value);

    if (error) {
      return c.json(
        {
          error: "Invalid request data",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }

    return data;
  }),
  validator("cookie", async (_, c) => {
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session) {
        return c.json({ error: "Authentication required" }, 401);
      }

      return session;
    } catch (error) {
      console.error("Session validation error:", error);
      return c.json({ error: "Authentication failed" }, 401);
    }
  }),
  async (c) => {
    try {
      const {
        session,
        user: { quota, usedQuota },
      } = c.req.valid("cookie");
      const { filename, size } = await c.req.valid("json");

      // Validate file size
      if (size <= 0) {
        return c.json({ error: "File size must be greater than 0" }, 400);
      }

      // Check if file extension is blacklisted
      if (isFileExtensionBlacklisted(filename)) {
        const fileExt = path.extname(filename);
        return c.json(
          {
            error: `File extension '${fileExt}' is not allowed`,
          },
          400
        );
      }

      if (size > SETTINGS.maxFileSize) {
        return c.json(
          {
            error: `File size exceeds ${formatFileSize(SETTINGS.maxFileSize)} limit`,
          },
          400
        );
      }

      const currentUsedQuota = usedQuota ?? 0;
      const currentQuota = quota ?? 0;

      // Skip quota checks if quota is 0 (unlimited)
      if (currentQuota > 0) {
        const remainingQuota = currentQuota - currentUsedQuota;

        if (remainingQuota <= 0) {
          return c.json(
            {
              error: "Storage quota exceeded",
              usedQuota: currentUsedQuota,
              totalQuota: currentQuota,
            },
            403
          );
        }

        if (size > remainingQuota) {
          return c.json(
            {
              error: "File size exceeds remaining quota",
              fileSize: size,
              remainingQuota,
              usedQuota: currentUsedQuota,
              totalQuota: currentQuota,
            },
            403
          );
        }
      }

      const id = generateId(24);
      const chunkSize = SETTINGS.chunkSize;
      const totalChunks = Math.ceil(size / chunkSize);

      registry.set(id, {
        chunks: new Set<number>(),
        size,
        finished: false,
        filename,
        totalChunks,
        userId: session.userId,
        chunkSize,
      });

      return c.json({
        id,
        chunkSize,
        totalChunks,
        message: "Upload initialized successfully",
      });
    } catch (error) {
      console.error("Upload initialization error:", error);
      return c.json({ error: "Failed to initialize upload" }, 500);
    }
  }
);

export default app;
