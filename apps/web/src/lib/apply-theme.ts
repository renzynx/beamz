import type { ThemeState } from "./types";

export function applyTheme(
  themeState: ThemeState,
  root: HTMLElement = document.documentElement,
) {
  const { currentMode, styles } = themeState;
  const active = styles[currentMode] || {};

  Object.entries(active).forEach(([key, value]) => {
    if (typeof value === "string") {
      root.style.setProperty(`--${key}`, value);
    }
  });

  if (currentMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
