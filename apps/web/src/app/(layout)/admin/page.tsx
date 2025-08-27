import { CronSettings } from "@/features/admin/CronSettings";
import { GeneralSettings } from "@/features/admin/GeneralSettings";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  prefetch(trpc.settings.get.queryOptions());

  return (
    <HydrateClient>
      <h3 className="mb-4 font-semibold text-xl">Global Settings</h3>
      <div className="space-y-6">
        <GeneralSettings />
        <CronSettings />
      </div>
    </HydrateClient>
  );
}
