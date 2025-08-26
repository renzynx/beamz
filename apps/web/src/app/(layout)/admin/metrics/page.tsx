import { MetricsContent } from "@/features/admin/MetricsContent";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default function MetricsPage() {
	prefetch(
		trpc.metrics.overview.queryOptions({
			days: 7,
		}),
	);
	prefetch(
		trpc.metrics.overview.queryOptions({
			days: 14,
		}),
	);

	return (
		<HydrateClient>
			<MetricsContent />
		</HydrateClient>
	);
}
