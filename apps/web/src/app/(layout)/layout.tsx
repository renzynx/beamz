import { UserButton } from "@daveyplate/better-auth-ui";
import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModeToggle } from "@/components/ModeToggle";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { AppSidebar } from "./_components/AppSidebar";

export const metadata: Metadata = {
	title: "Dashboard",
};

export default async function DashboardLayout({
	children,
	sidebar,
}: {
	children: ReactNode;
	sidebar: ReactNode;
}) {
	prefetch(trpc.settings.public.queryOptions());

	return (
		<SidebarProvider>
			<HydrateClient>
				<AppSidebar>{sidebar}</AppSidebar>
				<SidebarInset>
					<header className="@container flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-4 transition-all ease-linear md:px-6 lg:px-8">
						<div className="flex flex-1 items-center gap-2">
							<SidebarTrigger className="-ms-1" />
						</div>

						<div className="flex items-center gap-2">
							<ModeToggle />
							<UserButton
								size="icon"
								additionalLinks={[
									{
										href: "/dashboard",
										label: "Dashboard",
										icon: <LayoutDashboard />,
										signedIn: true,
									},
								]}
							/>
						</div>
					</header>
					<div className="@container p-4 md:p-6 lg:p-8">{children}</div>
				</SidebarInset>
			</HydrateClient>
		</SidebarProvider>
	);
}
