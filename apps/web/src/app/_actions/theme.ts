"use server";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";

export async function setTheme(theme: string) {
  try {
    const cookieStore = await cookies();

    // If theme is "default", remove the cookie to reset to default behavior
    if (theme === "default") {
      cookieStore.delete("ui-theme");
    } else {
      cookieStore.set("ui-theme", theme);
    }

    return theme;
  } catch (error) {
    console.error("Error setting theme:", error);
    throw new Error("Failed to set theme");
  }
}

export async function getTheme() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("ui-theme")?.value ?? "default";
  } catch (error) {
    console.error("Error getting theme:", error);
    return "default";
  }
}

export async function getThemeList() {
  const themesDir = join(process.cwd(), "src/themes");

  const fileThemes = readdirSync(themesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(".json", ""));

  return ["default", ...fileThemes];
}
