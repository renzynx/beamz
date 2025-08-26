"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props extends Omit<React.ComponentProps<typeof Button>, "children"> {
	tooltip: React.ReactNode;
	loadingTooltip?: React.ReactNode;
	isLoading?: boolean;
	srLabel?: string;
	children: React.ReactNode;
}

export function ButtonWithTooltip({
	tooltip,
	loadingTooltip,
	isLoading = false,
	srLabel,
	children,
	...buttonProps
}: Props) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button {...buttonProps}>
					{children}
					{srLabel ? <span className="sr-only">{srLabel}</span> : null}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>{isLoading ? (loadingTooltip ?? "Working...") : tooltip}</p>
			</TooltipContent>
		</Tooltip>
	);
}
