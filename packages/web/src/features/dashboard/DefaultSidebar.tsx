"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/hooks/use-session";
import { Home, UploadCloud, Settings, ShieldUser } from "lucide-react";
import { usePathname } from "next/navigation";

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
      <SidebarGroupLabel className="uppercase text-muted-foreground/65">
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
                  className="group/menu-button group-data-[collapsible=icon]:px-[5px]! font-medium gap-3 h-9 [&>svg]:size-auto"
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
