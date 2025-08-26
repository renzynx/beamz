"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilesContext } from "@/contexts/FilesContext";
import { useTRPC } from "@/trpc/client";
import { ActionBar } from "./ActionBar";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { FileHeader } from "./FileHeader";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FilePropertiesDialog } from "./FilePropertiesDialog";
import { FilesPagination } from "./FilesPagination";

const FilesTable = dynamic(() =>
	import("./FilesTable").then((mod) => ({ default: mod.FilesTable })),
);

const FilesGrid = dynamic(() =>
	import("./FilesGrid").then((mod) => ({ default: mod.FilesGrid })),
);

export function FilesView({ view }: { view: string }) {
	const { pagination, sortBy, sortDir, selectedFiles, previewFile } =
		useFilesContext();

	const trpc = useTRPC();

	const {
		data: { data, total },
		refetch,
	} = useSuspenseQuery(
		trpc.files.get.queryOptions({
			offset: pagination.pageIndex * pagination.pageSize,
			limit: pagination.pageSize,
			sortBy: sortBy,
			sortDir: sortDir,
		}),
	);

	const selectedFileItems = data.filter((f) => selectedFiles.has(f.id));

	return (
		<>
			<ActionBar
				selectedCount={selectedFiles.size}
				selectedItems={selectedFileItems}
			/>
			<div className="space-y-4">
				<FileHeader view={view} refetch={refetch} />

				<Suspense
					fallback={view === "table" ? <TableSkeleton /> : <GridSkeleton />}
				>
					{view === "table" ? (
						<FilesTable data={data} total={total} />
					) : (
						<FilesGrid data={data} />
					)}
				</Suspense>

				{total > 0 && <FilesPagination total={total} />}

				<FilePropertiesDialog />
				{previewFile && <FilePreviewDialog />}
				<DeleteConfirmationDialog />
			</div>
		</>
	);
}

function TableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-md border bg-background">
				<div className="border-b p-4">
					<div className="flex items-center space-x-4">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-16" />
					</div>
				</div>
				{Array.from({ length: 20 }).map((_, i) => (
					<div key={i} className="border-border/50 border-b p-4">
						<div className="flex items-center space-x-4">
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-16" />
						</div>
					</div>
				))}
			</div>
			{/* Pagination skeleton */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-9 w-32" />
				<Skeleton className="h-4 w-64" />
				<div className="flex space-x-2">
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
				</div>
			</div>
		</div>
	);
}

function GridSkeleton() {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
				{Array.from({ length: 24 }).map((_, i) => (
					<div key={i} className="overflow-hidden rounded-xl border bg-card">
						{/* Thumbnail skeleton */}
						<Skeleton className="aspect-video w-full" />
						{/* Content skeleton */}
						<div className="space-y-2 p-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
							<div className="flex justify-between">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-5 w-12" />
							</div>
							<Skeleton className="h-3 w-20" />
						</div>
					</div>
				))}
			</div>
			{/* Pagination skeleton */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-9 w-32" />
				<Skeleton className="h-4 w-64" />
				<div className="flex space-x-2">
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
					<Skeleton className="h-9 w-9" />
				</div>
			</div>
		</div>
	);
}
