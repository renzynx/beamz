"use client";

import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient as createAuthClientReact } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [authClient] = useState(() =>
		createAuthClientReact({
			basePath: "/api/auth",
			plugins: [adminClient()],
			user: {
				additionalFields: {
					quota: {
						type: "number",
						required: false,
						defaultValue: 0,
						input: false,
					},
					usedQuota: {
						type: "number",
						required: false,
						defaultValue: 0,
						input: false,
					},
				},
			},
		}),
	);

	return (
		<>
			<TRPCReactProvider>
				<AuthQueryProvider>
					<AuthUIProviderTanstack
						authClient={authClient}
						navigate={router.push}
						replace={router.replace}
						onSessionChange={() => router.refresh()}
						Link={Link}
						account={{
							basePath: "/dashboard",
						}}
						deleteUser
					>
						{children}
					</AuthUIProviderTanstack>
				</AuthQueryProvider>
			</TRPCReactProvider>
			<Toaster richColors closeButton position="bottom-center" />
		</>
	);
}
