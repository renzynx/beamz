"use client";

import type { FC, HTMLAttributes } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { applyTheme as applyTokenTheme } from "@/lib/apply-theme";
import { script } from "@/lib/theme-script";
import type {
	Mode,
	ThemeContextType,
	ThemeProviderProps,
	ThemeState,
	ThemeStyles,
} from "@/lib/types";

type NamedTheme = {
	name?: string;
	light: Record<string, string>;
	dark: Record<string, string>;
};

// allow passing available theme names from a server component that can call getThemeList()
const DEFAULT_THEME_KEYS = ["amethyst-haze"];

const MEDIA = "(prefers-color-scheme: dark)";
const isServer = typeof window === "undefined";

const defaultThemeState: ThemeState = {
	currentMode: "light",
	styles: {
		// When there is no 'default' named theme, fall back to empty tokens
		light: {} as ThemeStyles,
		dark: {} as ThemeStyles,
	},
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function safeGetLS(key: string) {
	if (isServer) return undefined;
	try {
		return localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
}
function safeSetLS(key: string, value: string | undefined) {
	if (isServer) return;
	try {
		if (value === undefined) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {}
}

function getSystemTheme(): Mode {
	if (isServer) return "light";
	return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

// simple in-memory cache for dynamically imported themes to avoid re-fetching
const themeCache = new Map<string, NamedTheme | null>();
async function loadThemeByName(name: string): Promise<NamedTheme | undefined> {
	if (!name) return undefined;
	if (themeCache.has(name)) return themeCache.get(name) ?? undefined;
	try {
		// dynamic import using the same alias used in the project
		const mod = await import(`@/themes/${name}.json`);
		const theme = (mod.default ?? mod) as NamedTheme;
		themeCache.set(name, theme ?? null);
		return theme;
	} catch {
		// cache negative result to avoid repeated attempts
		themeCache.set(name, null);
		return undefined;
	}
}

// Inline pre-hydration script component moved to module scope to avoid lint warnings
/* eslint-disable react/no-danger */
export const InlineThemeScript: FC<{
	storageKey: string;
	modeKey: string;
	defaultTheme: string;
	forcedTheme?: string;
	enableSystem: boolean;
	enableColorScheme: boolean;
	nonce?: string;
	scriptProps?: HTMLAttributes<HTMLScriptElement>;
	availableThemes?: string[];
	availableThemeDefs?: Record<string, NamedTheme>;
}> = ({
	storageKey,
	modeKey,
	defaultTheme,
	forcedTheme,
	enableSystem,
	enableColorScheme,
	nonce,
	scriptProps,
	availableThemes,
	availableThemeDefs,
}) => {
	// build the argument list. script expects storageKey and modeKey so pre-hydration can read both.
	// pass the full themeDefinitions object so the pre-hydration script can index by name
	const inlineDefsObj = availableThemeDefs ?? {};
	const scriptArgs = JSON.stringify([
		"class",
		storageKey,
		modeKey,
		defaultTheme,
		forcedTheme,
		availableThemes ?? DEFAULT_THEME_KEYS,
		undefined,
		enableSystem,
		enableColorScheme,
		inlineDefsObj,
	]).slice(1, -1);

	// Add a tiny inline style to disable CSS transitions while pre-hydration runs and hide flash
	const disableTransitionsCss =
		".theme-prevent-transitions *{transition:none!important;animation:none!important;} .theme-prevent-flash{visibility:hidden!important;}";

	return (
		<>
			<style>{disableTransitionsCss}</style>
			<script
				{...scriptProps}
				suppressHydrationWarning
				nonce={nonce}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: <i dont care>
				dangerouslySetInnerHTML={{
					__html: `document.documentElement.classList.add('theme-prevent-transitions','theme-prevent-flash'); (${script.toString()})(${scriptArgs});`,
				}}
			/>
		</>
	);
};

export const ThemeProvider: FC<
	ThemeProviderProps & {
		availableThemes?: string[];
		availableThemeDefs?: Record<string, NamedTheme>;
	}
> = ({
	forcedTheme,
	storageKey = "theme",
	defaultTheme = "default",
	enableSystem = true,
	enableColorScheme = true,
	children,
	availableThemes,
	availableThemeDefs,
}) => {
	const modeKey = `${storageKey}-mode`;

	// named theme (e.g. 'default' or 'amethyst-haze')
	const [namedTheme, setNamedTheme] = useState<string | undefined>(() => {
		if (isServer) return forcedTheme ?? defaultTheme;
		return safeGetLS(storageKey) ?? forcedTheme ?? defaultTheme;
	});

	// color-scheme preference: 'light' | 'dark' | 'system'
	const [colorPref, setColorPref] = useState<"light" | "dark" | "system">(
		() => {
			if (isServer) return enableSystem ? "system" : "light";
			return (safeGetLS(modeKey) ?? (enableSystem ? "system" : "light")) as
				| "light"
				| "dark"
				| "system";
		},
	);

	const [themeState, setThemeState] = useState<ThemeState>(
		() => defaultThemeState,
	);

	const resolveModeFrom = useCallback(
		(selectedName?: string, pref?: string) => {
			// pref takes precedence if explicit
			if (pref) {
				if (pref === "system") return enableSystem ? getSystemTheme() : "light";
				if (pref === "dark" || pref === "light") return pref as Mode;
			}
			// fallback: if the selected name is 'system' treat like pref === 'system'
			if (selectedName === "system")
				return enableSystem ? getSystemTheme() : "light";
			// default fallback
			return enableSystem ? getSystemTheme() : "light";
		},
		[enableSystem],
	);

	// Apply classes and tokens synchronously before paint where possible.
	useLayoutEffect(() => {
		const activeName = forcedTheme ?? namedTheme ?? defaultTheme;
		const mode = resolveModeFrom(namedTheme, colorPref);
		const el = document.documentElement;
		el.classList.remove("light", "dark");
		if (mode === "dark") el.classList.add("dark");
		else el.classList.add("light");

		if (enableColorScheme) {
			try {
				el.style.colorScheme = mode;
			} catch {}
		}

		let cancelled = false;

		(async () => {
			if (!activeName || activeName === "default") {
				// no named theme definitions; only update mode
				setThemeState((s) => ({ ...s, currentMode: mode as Mode }));
				return;
			}

			const def = await loadThemeByName(activeName);
			if (cancelled) return;
			if (def) {
				setThemeState({
					currentMode: mode as Mode,
					styles: {
						light: def.light as ThemeStyles,
						dark: def.dark as ThemeStyles,
					},
				});
				applyTokenTheme(
					{
						currentMode: mode as Mode,
						styles: {
							light: def.light as ThemeStyles,
							dark: def.dark as ThemeStyles,
						},
					},
					el,
				);
			} else {
				setThemeState((s) => ({ ...s, currentMode: mode as Mode }));
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		namedTheme,
		colorPref,
		forcedTheme,
		defaultTheme,
		resolveModeFrom,
		enableColorScheme,
	]);

	// Sync storage: named theme and colorPref tracked under separate keys
	useEffect(() => {
		if (isServer) return;
		if (forcedTheme) {
			// mirror SSR provided named theme
			safeSetLS(storageKey, forcedTheme);
			setNamedTheme(forcedTheme);
			return;
		}
		safeSetLS(storageKey, namedTheme);
	}, [namedTheme, forcedTheme, storageKey]);

	useEffect(() => {
		if (isServer) return;
		safeSetLS(modeKey, colorPref);
	}, [colorPref, modeKey]);

	// populate cache from server-provided inline definitions so client doesn't need to re-fetch
	useEffect(() => {
		if (!availableThemeDefs) return;
		Object.entries(availableThemeDefs).forEach(([k, v]) => {
			themeCache.set(k, v as NamedTheme);
		});
	}, [availableThemeDefs]);

	// listen for storage events to sync across tabs for both keys
	useEffect(() => {
		if (isServer) return;
		const onStorage = (e: StorageEvent) => {
			if (e.key === storageKey) setNamedTheme(e.newValue ?? undefined);
			if (e.key === modeKey) {
				const newVal = e.newValue;
				const valid =
					newVal === "light" || newVal === "dark" || newVal === "system";
				setColorPref(
					valid
						? (newVal as "light" | "dark" | "system")
						: enableSystem
							? "system"
							: "light",
				);
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [storageKey, modeKey, enableSystem]);

	// watch system changes when pref is 'system' or selected named theme is 'system'
	useEffect(() => {
		if (isServer) return;
		const mql = window.matchMedia(MEDIA);
		const handler = () => {
			if (colorPref === "system" || namedTheme === "system") {
				// re-resolve
				setNamedTheme((s) => (s ? s : s));
			}
		};

		type Mql = MediaQueryList & {
			addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
			removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
		};
		const mqlTyped = mql as Mql;
		const onChange = () => handler();
		if (typeof mqlTyped.addEventListener === "function")
			mqlTyped.addEventListener("change", onChange as EventListener);
		else if (typeof mqlTyped.addListener === "function")
			mqlTyped.addListener(onChange);
		return () => {
			if (typeof mqlTyped.removeEventListener === "function")
				mqlTyped.removeEventListener("change", onChange as EventListener);
			else if (typeof mqlTyped.removeListener === "function")
				mqlTyped.removeListener(onChange);
		};
	}, [colorPref, namedTheme, enableSystem]);

	// Explicit setter for named theme: updates storage and React state
	const updateNamedTheme = (n: string | undefined) => {
		safeSetLS(storageKey, n ?? undefined);
		setNamedTheme(n);
	};

	const setColorScheme = useCallback(
		(v: "light" | "dark" | "system") => {
			// persist
			safeSetLS(modeKey, v);
			setColorPref(v);
			// immediate DOM update
			const activeName = forcedTheme ?? namedTheme ?? defaultTheme;
			const mode =
				v === "system" ? (enableSystem ? getSystemTheme() : "light") : v;
			const el = document.documentElement;
			el.classList.remove("light", "dark");
			if (mode === "dark") el.classList.add("dark");
			else el.classList.add("light");

			if (enableColorScheme) {
				try {
					el.style.colorScheme = mode;
				} catch {}
			}

			(async () => {
				if (!activeName || activeName === "default") {
					setThemeState((s) => ({ ...s, currentMode: mode as Mode }));
					return;
				}
				const def = await loadThemeByName(activeName);
				if (def) {
					setThemeState({
						currentMode: mode as Mode,
						styles: {
							light: def.light as ThemeStyles,
							dark: def.dark as ThemeStyles,
						},
					});
					applyTokenTheme(
						{
							currentMode: mode as Mode,
							styles: {
								light: def.light as ThemeStyles,
								dark: def.dark as ThemeStyles,
							},
						},
						el,
					);
				} else {
					setThemeState((s) => ({ ...s, currentMode: mode as Mode }));
				}
			})();
		},
		[
			modeKey,
			forcedTheme,
			namedTheme,
			defaultTheme,
			enableSystem,
			enableColorScheme,
		],
	);

	// Backwards-compatible setTheme: if passed 'light'|'dark'|'system' treat as color pref, else treat as named theme
	const setTheme = useCallback(
		(v: React.SetStateAction<string | undefined>) => {
			if (typeof v === "function") {
				setNamedTheme((prev) => {
					const next = (v as (p: string | undefined) => string | undefined)(
						prev,
					);
					if (next === "light" || next === "dark" || next === "system")
						setColorScheme(next as "light" | "dark" | "system");
					else updateNamedTheme(next);
					return next;
				});
			} else {
				if (v === "light" || v === "dark" || v === "system")
					setColorScheme(v as "light" | "dark" | "system");
				else updateNamedTheme(v);
			}
		},
		[setColorScheme],
	);

	const toggleTheme = useCallback(() => {
		const current = themeState.currentMode;
		const nextMode = current === "dark" ? "light" : "dark";
		setColorScheme(nextMode);
	}, [themeState.currentMode, setColorScheme]);

	const themeKeys = availableThemes ?? DEFAULT_THEME_KEYS;

	// remove the prevent-transitions class after mount so transitions work normally
	useEffect(() => {
		if (isServer) return;
		document.documentElement.classList.remove("theme-prevent-transitions");
	}, []);

	const value = useMemo(
		() => ({
			themeState,
			setThemeState,
			toggleTheme,
			setMode: (m: Mode) => setThemeState((s) => ({ ...s, currentMode: m })),
			mode: themeState.currentMode,
			// APIs
			theme: namedTheme,
			setTheme, // backward-compatible
			setNamedTheme: (n?: string) => updateNamedTheme(n ?? undefined),
			colorScheme: colorPref,
			setColorScheme: (m: "light" | "dark" | "system") => setColorScheme(m),
			forcedTheme,
			resolvedTheme:
				namedTheme === "system"
					? isServer
						? undefined
						: getSystemTheme()
					: namedTheme,
			themes: themeKeys,
			systemTheme: enableSystem
				? isServer
					? undefined
					: getSystemTheme()
				: undefined,
		}),
		[
			themeState,
			setTheme,
			toggleTheme,
			namedTheme,
			colorPref,
			forcedTheme,
			enableSystem,
		],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
	return ctx;
}
