"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setTheme as setThemeAction } from "@/app/_actions/theme";
import { useTheme } from "@/app/_components/ThemeProvider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type Props = {
	themes?: string[]; // server-provided named themes from getThemeList()
	currentTheme?: string; // server-provided current theme from getTheme()
	className?: string;
	size?: "sm" | "default";
};

export default function ThemeSelect({
	themes: propThemes,
	currentTheme: propCurrent,
	className,
	size = "default",
}: Props) {
	const ctx = useTheme();
	const ctxThemes = ctx.themes ?? [];
	const themes = propThemes ?? ctxThemes;
	const ctxTheme = ctx.theme;
	const [value, setValue] = useState<string>(propCurrent ?? ctxTheme ?? "");
	const setNamedTheme = ctx.setNamedTheme ?? ((n?: string) => ctx.setTheme(n));

	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (propCurrent) setValue(propCurrent);
		else if (ctxTheme) setValue(ctxTheme);
	}, [propCurrent, ctxTheme]);

	const humanize = (key: string) =>
		key.replace(/[-_]+/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());

	const handleChange = (v: string) => {
		setValue(v);
		// If consumer passed themes/currentTheme then persist server-side via action
		if (propThemes || propCurrent !== undefined) {
			startTransition(() => {
				void setThemeAction(v).then(() => router.refresh());
			});
			return;
		}

		setNamedTheme(v);
	};

	return (
		<div className={className}>
			<Select value={value ?? ""} onValueChange={handleChange}>
				<SelectTrigger size={size}>
					<SelectValue placeholder={"Select theme"} />
				</SelectTrigger>
				<SelectContent>
					{themes.map((t) => {
						const label = humanize(t);
						return (
							<SelectItem key={t} value={t}>
								{label}
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
			{isPending ? (
				<span className="ml-2 text-muted-foreground text-sm">Saving…</span>
			) : null}
		</div>
	);
}
