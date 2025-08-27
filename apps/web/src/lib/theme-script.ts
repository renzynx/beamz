export const script = (
	// attribute not used by this minimal pre-hydration script
	_storageAttribute: string | string[],
	storageKey: string,
	modeKey: string,
	defaultTheme: string,
	forcedTheme: string | undefined,
	_unusedThemes: string[],
	_value: Record<string, string> | undefined,
	enableSystem: boolean,
	enableColorScheme: boolean,
	themeDefinitions?: Record<
		string,
		{ light: Record<string, string>; dark: Record<string, string> }
	>,
) => {
	const el = document.documentElement;
	const systemThemes = ["light", "dark"];

	function setTokenTheme(themeName: string, resolvedMode: string) {
		if (!themeDefinitions) return;
		const def = themeDefinitions?.[themeName];
		if (!def) return;
		const tokens = def[resolvedMode as "light" | "dark"] || {};
		Object.keys(tokens).forEach((k) => {
			try {
				el.style.setProperty(`--${k}`, tokens[k]);
			} catch {
				// ignore
			}
		});
	}

	function setColorSchemeOnRoot(theme: string) {
		if (enableColorScheme && systemThemes.includes(theme)) {
			try {
				el.style.colorScheme = theme;
			} catch {
				// ignore
			}
		}
		if (theme === "dark") {
			el.classList.add("dark");
			el.classList.remove("light");
		} else {
			el.classList.remove("dark");
			el.classList.add("light");
		}
	}

	function getSystemTheme() {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	}

	try {
		// Mirror the SSR-provided named theme into localStorage so client pre-hydration sees it
		// but do NOT mirror the 'default' special value — globals.css covers default.
		if (forcedTheme && forcedTheme !== "default") {
			try {
				localStorage.setItem(storageKey, forcedTheme);
			} catch {}
		}

		// Read stored named theme and stored color mode (two separate keys)
		let storedNamed = undefined as string | null | undefined;
		let storedMode = undefined as string | null | undefined;
		try {
			storedNamed = localStorage.getItem(storageKey);
		} catch {}
		try {
			storedMode = localStorage.getItem(modeKey);
		} catch {}

		// Choose active named theme: prefer forcedTheme (SSR) then storedNamed then defaultTheme
		const activeNamed = forcedTheme ?? storedNamed ?? defaultTheme;

		// Decide resolved mode:
		// Prefer forcedTheme when present (so SSR intent isn't overridden by stale storedMode), else prefer storedMode, else derive from system/default
		let resolvedMode: string;
		if (forcedTheme) {
			if (forcedTheme === "system" && enableSystem)
				resolvedMode = getSystemTheme();
			else if (forcedTheme === "dark" || forcedTheme === "light")
				resolvedMode = forcedTheme;
			else resolvedMode = enableSystem ? getSystemTheme() : "light";
		} else if (storedMode) {
			resolvedMode = storedMode;
		} else {
			resolvedMode = enableSystem ? getSystemTheme() : "light";
		}

		// apply color-scheme class + style
		setColorSchemeOnRoot(resolvedMode);

		// apply tokens for named theme if available and not 'default'
		if (
			activeNamed &&
			activeNamed !== "default" &&
			themeDefinitions &&
			themeDefinitions[activeNamed]
		) {
			setTokenTheme(activeNamed, resolvedMode);
		}

		// remove temporary pre-hydration classes so the page becomes visible and transitions re-enable
		document.documentElement.classList.remove(
			"theme-prevent-transitions",
			"theme-prevent-flash",
		);
	} catch {
		// ignore any errors during pre-hydration
		try {
			document.documentElement.classList.remove(
				"theme-prevent-transitions",
				"theme-prevent-flash",
			);
		} catch {}
	}
};
