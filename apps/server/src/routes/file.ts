import { UPLOAD_DIR } from "@/lib/constants";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const app = new Hono();

app.get(
  "/f/:path",
  validator("param", async ({ path }, c) => {
    if (!path) {
      return c.text("Not Found", 404);
    }

    return path;
  }),
  async (c) => {
    const path = c.req.valid("param");

    // sanitize path
    const sanitizedPath = path.replace(/\.\.(\/|\\)/g, "").replace(/\/+/g, "/");

    const filePath = join(UPLOAD_DIR, sanitizedPath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return c.text("Not Found", 404);
    }

    c.header("Cache-Control", "public, max-age=31536000, immutable");

    return c.body(Bun.file(filePath).stream());
  },
);

export default app;
