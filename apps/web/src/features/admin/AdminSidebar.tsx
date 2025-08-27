"use client";

import { ChartPie, Clock, CornerLeftUp, Settings2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = [
  {
    title: "Admin",
    items: [
      {
        title: "Global Settings",
        url: "/admin",
        icon: Settings2,
      },
      {
        title: "Metrics",
        url: "/admin/metrics",
        icon: ChartPie,
      },
      {
        title: "Users",
        url: "/admin/users",
        icon: Users,
      },
      {
        title: "Background Jobs",
        url: "/admin/background-jobs",
        icon: Clock,
      },
      {
        title: "Return to Site",
        url: "/dashboard",
        icon: CornerLeftUp,
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return data.map((item) => (
    <SidebarGroup key={item.title}>
      <SidebarGroupLabel className="text-muted-foreground/65 uppercase">
        {item.title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {item.items.map((item) => (
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
