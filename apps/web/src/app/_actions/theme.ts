"use server";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";

export async function setTheme(theme: string) {
	const cookieStore = await cookies();

	cookieStore.set("ui-theme", theme);

	return theme;
}

export async function getTheme() {
	const cookieStore = await cookies();
	return cookieStore.get("ui-theme")?.value ?? "default";
}

export async function getThemeList() {
	const themesDir = join(process.cwd(), "src/themes");

	return readdirSync(themesDir)
		.filter((file) => file.endsWith(".json"))
		.map((file) => file.replace(".json", ""));
}
