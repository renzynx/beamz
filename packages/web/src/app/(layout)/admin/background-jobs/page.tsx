import BackgroundJobsHeader from "@/features/admin/BackgroundJobsHeader";
import { BackgroundJobsTable } from "@/features/admin/BackgroundJobsTable";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function BackgroundJobs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const page = params.page ? Math.max(1, Number.parseInt(params.page, 10)) : 1;
  const pageSize = params.pageSize
    ? Math.max(1, Number.parseInt(params.pageSize, 10))
    : 20;
  const offset = (page - 1) * pageSize;

  prefetch(
    trpc.jobs.listJobs.queryOptions({
      offset,
      limit: pageSize,
      sortBy: (params?.sortBy as any) || "createdAt",
      sortDir: (params?.sortDir as any) || "desc",
    })
  );

  return (
    <HydrateClient>
      <BackgroundJobsHeader />
      <BackgroundJobsTable />
    </HydrateClient>
  );
}
