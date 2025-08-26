"use client";

import { Home, Settings, ShieldUser, UploadCloud } from "lucide-react";
import { usePathname } from "next/navigation";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/hooks/use-session";

const data = [
	{
		title: "General",
		items: [
			{
				title: "Home",
				url: "/dashboard",
				icon: Home,
			},
			{
				title: "Upload",
				url: "/dashboard/upload",
				icon: UploadCloud,
			},
			{
				title: "Settings",
				url: "/dashboard/settings",
				icon: Settings,
			},
			{
				title: "Admin",
				url: "/admin",
				icon: ShieldUser,
				isAdmin: true,
			},
		],
	},
];

export function DefaultSidebar() {
	const { data: sessionData } = useSession();
	const pathname = usePathname();

	return data.map((item) => (
		<SidebarGroup key={item.title}>
			<SidebarGroupLabel className="text-muted-foreground/65 uppercase">
				{item.title}
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{item.items
						.filter((item) => {
							if (item.isAdmin) {
								return sessionData?.user?.role === "admin";
							}
							return true;
						})
						.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									asChild
									className="group/menu-button h-9 gap-3 font-medium group-data-[collapsible=icon]:px-[5px]! [&>svg]:size-auto"
									tooltip={item.title}
									isActive={pathname === item.url}
								>
									<a href={item.url}>
										{item.icon && (
											<item.icon
												className="text-muted-foreground/65 group-data-[active=true]/menu-button:text-primary"
												size={22}
												aria-hidden="true"
											/>
										)}
										<span>{item.title}</span>
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	));
}
