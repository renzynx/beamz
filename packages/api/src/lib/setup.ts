import { db, settings, user, count, eq } from "@beam/db";
import { runMigrations } from "@beam/db/migrate";
import { SETTINGS } from "./settings";
import { SECRET } from "./constants";

if (!SECRET) {
  throw new Error("SECRET is not defined");
}

(async () => {
  await runMigrations();

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
