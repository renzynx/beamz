import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import path from "path";
import { db } from "./index";

async function runMigrations() {
	console.log("Running database migrations...");

	try {
		await migrate(db, {
			migrationsFolder: path.resolve(__dirname, "./migrations"),
		});
		console.log("Migrations completed successfully!");
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

if (import.meta.main) {
	runMigrations();
}

export { runMigrations };
