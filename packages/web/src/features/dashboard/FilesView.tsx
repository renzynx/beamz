"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ActionBar } from "./ActionBar";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { FileHeader } from "./FileHeader";
import { FilePropertiesDialog } from "./FilePropertiesDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { useFilesContext } from "@/contexts/FilesContext";
import { FilesPagination } from "./FilesPagination";

const FilesTable = dynamic(() =>
  import("./FilesTable").then((mod) => ({ default: mod.FilesTable }))
);

const FilesGrid = dynamic(() =>
  import("./FilesGrid").then((mod) => ({ default: mod.FilesGrid }))
);

export function FilesView({ view }: { view: string }) {
  const { pagination, sortBy, sortDir, selectedFiles } = useFilesContext();

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
    })
  );

  return (
    <>
      <ActionBar selectedCount={selectedFiles.size} />
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
        <FilePreviewDialog />
        <DeleteConfirmationDialog />
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-background overflow-hidden rounded-md border">
        <div className="p-4 border-b">
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
          <div key={i} className="p-4 border-b border-border/50">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border overflow-hidden">
            {/* Thumbnail skeleton */}
            <Skeleton className="aspect-video w-full" />
            {/* Content skeleton */}
            <div className="p-3 space-y-2">
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
