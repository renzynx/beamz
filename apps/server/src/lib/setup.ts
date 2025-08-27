import { count, db, eq, runMigrations, settings, user } from "@beam/database";
import { promises as fs } from "node:fs";
import { SECRET, TEMP_DIR } from "./constants";
import { SETTINGS } from "./settings";

if (!SECRET) {
  throw new Error("SECRET is not defined");
}

(async () => {
  try {
    await runMigrations();
  } catch {}
  await fs.mkdir(TEMP_DIR, { recursive: true });

  let [data, [{ userCount }]] = await Promise.all([
    db.select().from(settings),
    db.select({ userCount: count() }).from(user).where(eq(user.role, "admin")),
  ]);

  if (data.length === 0) {
    data = await db.insert(settings).values({}).returning();
  }

  Object.assign(SETTINGS, {
    ...data[0],
    initialized: userCount > 0,
  });
})();
