"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { BackgroundJobsActionBar } from "./BackgroundJobsActionBar";

type JobItem = any;

interface JobsQueryResult {
  data: JobItem[];
  total: number;
  offset: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const BackgroundJobsTable = () => {
  const trpc = useTRPC();
  const id = useId();

  // Pagination and sorting state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selection state
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const offset = pagination.pageIndex * pagination.pageSize;
  const limit = pagination.pageSize;

  const query = useSuspenseQuery(
    trpc.jobs.listJobs.queryOptions({
      offset,
      limit,
      sortBy: sortBy as any,
      sortDir,
    }),
  );

  const data: JobsQueryResult | undefined = query.data as any;
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // Selection helpers
  const isJobSelected = (id: string) => selectedJobs.has(id);
  const toggleJobSelection = (id: string) =>
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllJobs = (ids: string[]) => setSelectedJobs(new Set(ids));
  const deselectAllJobs = () => setSelectedJobs(new Set());

  const handleSort = (columnId: string) => {
    if (rows.length === 0) return;
    if (sortBy === columnId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnId);
      setSortDir("desc");
    }
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const getSortState = (columnId: string): "asc" | "desc" | false => {
    if (sortBy !== columnId) return false;
    return sortDir;
  };

  const isAllSelected =
    rows.length > 0 && rows.every((r) => isJobSelected(r.id));
  const isSomeSelected = rows.some((r) => isJobSelected(r.id));

  const handleSelectAll = () => {
    if (isAllSelected) deselectAllJobs();
    else selectAllJobs(rows.map((r) => r.id));
  };

  const columns: ColumnDef<JobItem>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={isJobSelected(row.original.id)}
          onCheckedChange={() => toggleJobSelection(row.original.id)}
          aria-label="Select row"
        />
      ),
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: "queue",
      header: () => "Queue",
      cell: (ctx) => ctx.getValue(),
    },
    {
      accessorKey: "status",
      header: () => "Status",
      cell: (ctx) => ctx.getValue(),
    },
    {
      accessorKey: "attempts",
      header: () => "Attempts",
      cell: (ctx) => String(ctx.getValue()),
    },
    {
      accessorKey: "createdAt",
      header: () => "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: "completedAt",
      header: () => "Completed",
      cell: ({ row }) =>
        row.original.completedAt ? formatDate(row.original.completedAt) : "-",
    },
    {
      id: "error",
      header: () => "Error",
      cell: (ctx) => (
        <div className="max-w-xs truncate">{ctx.row.original.error ?? ""}</div>
      ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    onPaginationChange: (updater) => {
      setPagination((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    state: { pagination },
    rowCount: total,
  });

  const clearSelection = () => setSelectedJobs(new Set());

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border bg-background">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort =
                    header.column.id !== "select" && rows.length > 0;
                  const sortState = canSort
                    ? getSortState(header.column.id)
                    : false;
                  return (
                    <TableHead key={header.id} className="h-12 px-4">
                      {header.isPlaceholder ? null : canSort ? (
                        <div
                          className="flex h-full cursor-pointer select-none items-center justify-between gap-2 hover:text-foreground"
                          onClick={() => handleSort(header.column.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSort(header.column.id);
                            }
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortState === "asc" && <ChevronDownIcon size={16} />}
                          {sortState === "desc" && <ChevronUpIcon size={16} />}
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border/50 border-b"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 px-4 py-3 text-center"
                >
                  No jobs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="max-sm:sr-only">
            Rows per page
          </Label>
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={(value) => {
              setPagination((prev) => ({
                ...prev,
                pageSize: Number(value),
                pageIndex: 0,
              }));
            }}
          >
            <SelectTrigger id={id} className="w-fit whitespace-nowrap">
              <SelectValue placeholder="Select number of results" />
            </SelectTrigger>
            <SelectContent className="[&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2 [&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8">
              {[5, 10, 20, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex grow justify-end whitespace-nowrap text-muted-foreground text-sm">
          <p
            className="whitespace-nowrap text-muted-foreground text-sm"
            aria-live="polite"
          >
            <span className="text-foreground">
              {pagination.pageIndex * pagination.pageSize + 1}-
              {Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                total,
              )}
            </span>
            {" of "}
            <span className="text-foreground">{total}</span>
            {" • Page "}
            <span className="text-foreground">{pagination.pageIndex + 1}</span>
            {" of "}
            <span className="text-foreground">
              {Math.ceil(total / pagination.pageSize) || 1}
            </span>
          </p>
        </div>

        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to first page"
                >
                  <ChevronFirstIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  <ChevronLeftIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  <ChevronRightIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to last page"
                >
                  <ChevronLastIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <BackgroundJobsActionBar
        selectedIds={Array.from(selectedJobs)}
        onClearSelection={clearSelection}
      />
    </div>
  );
};
