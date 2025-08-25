import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ReactNode } from "react";
import { AppSidebar } from "./_components/AppSidebar";
import { Metadata } from "next";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ModeToggle } from "@/components/ModeToggle";
import { UserButton } from "@daveyplate/better-auth-ui";
import { LayoutDashboard } from "lucide-react";
import { authClient } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
  const { data } = await authClient.getSession({
    fetchOptions: { headers: await headers() },
  });

  if (!data?.user) {
    redirect("/auth/sign-in");
  }

  prefetch(trpc.settings.public.queryOptions());

  return (
    <SidebarProvider>
      <HydrateClient>
        <AppSidebar>{sidebar}</AppSidebar>
      </HydrateClient>
      <SidebarInset>
        <header className="flex flex-wrap gap-3 py-4 px-4 md:px-6 lg:px-8 @container shrink-0 items-center transition-all ease-linear border-b">
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
        <div className="p-4 md:p-6 lg:p-8 @container">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
