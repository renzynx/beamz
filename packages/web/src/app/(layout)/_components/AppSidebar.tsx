"use client";

import * as React from "react";

import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatFileSize } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const trpc = useTRPC();
  const {
    data: { appName },
  } = useSuspenseQuery(trpc.settings.public.queryOptions());

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="h-16 max-md:mt-2 mb-2 justify-center">
        <div className="ml-[2px] text-xl font-bold">
          {state === "expanded" ? appName : <Target size={36} />}
        </div>
      </SidebarHeader>
      <SidebarContent className={cn("-mt-2", state === "collapsed" && "ml-1")}>
        {props.children}
      </SidebarContent>
      <SidebarFooter>{state === "expanded" && <UserQuota />}</SidebarFooter>
    </Sidebar>
  );
}

function UserQuota() {
  const { data, isPending } = useSession();
  const quota = (data?.user as any)?.quota ?? 0;
  const usedQuota = (data?.user as any)?.usedQuota ?? 0;
  const quotaPercentage = React.useMemo(
    () => (quota > 0 ? Math.min((usedQuota / quota) * 100, 100) : 0),
    [quota, usedQuota]
  );
  const remainingQuota = React.useMemo(
    () => Math.max(quota - usedQuota, 0),
    [quota, usedQuota]
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between text-xs">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Used</span>
          <span className="font-medium">
            {formatFileSize(usedQuota)} of{" "}
            {quota === 0 ? "Unlimited" : formatFileSize(quota)}
          </span>
        </div>
        <Progress value={quotaPercentage} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(quotaPercentage)}% used</span>
          <span>
            {quota === 0 ? "Unlimited" : formatFileSize(remainingQuota)}{" "}
            remaining
          </span>
        </div>
      </div>
    </div>
  );
}
