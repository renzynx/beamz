import { cookies } from "next/headers";
import {
	FilesProvider,
	type SortByType,
	type SortDirType,
} from "@/contexts/FilesContext";
import { FilesView } from "@/features/dashboard/FilesView";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function Dashboard({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const params = await searchParams;
	const cookieStore = await cookies();
	const view = cookieStore.get("view")?.value || "grid";

	const page = params.page ? Math.max(1, Number.parseInt(params.page, 10)) : 1;
	const pageSize = params.pageSize
		? Math.max(1, Number.parseInt(params.pageSize, 10))
		: 20;
	const offset = (page - 1) * pageSize;

	prefetch(
		trpc.files.get.queryOptions({
			offset,
			limit: pageSize,
			sortBy: (params?.sortBy as SortByType) || "createdAt",
			sortDir: (params?.sortDir as SortDirType) || "desc",
		}),
	);

	return (
		<HydrateClient>
			<FilesProvider>
				<FilesView view={view} />
			</FilesProvider>
		</HydrateClient>
	);
}
