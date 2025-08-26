"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useFilesContext } from "@/contexts/FilesContext";
import type { FileItem } from "@/trpc/types";
import { columns } from "./FilesTableColumns";

interface FilesTableProps {
	data: FileItem[];
	total: number;
}

export function FilesTable({ data, total }: FilesTableProps) {
	const {
		pagination,
		setPagination,
		sortBy,
		sortDir,
		setSortBy,
		setSortDir,
		selectAllFiles,
		deselectAllFiles,
		toggleFileSelection,
		isFileSelected,
	} = useFilesContext();

	const handleSort = (columnId: string) => {
		if (data.length === 0) return;

		if (sortBy === columnId) {
			// Toggle direction if same column
			setSortDir(sortDir === "asc" ? "desc" : "asc");
		} else {
			// Set new column with default desc direction
			setSortBy(columnId as any);
			setSortDir("desc");
		}
	};

	// Get sort state for a column
	const getSortState = (columnId: string): "asc" | "desc" | false => {
		if (sortBy !== columnId) return false;
		return sortDir;
	};

	// Handle select all checkbox
	const isAllSelected =
		data.length > 0 && data.every((file: FileItem) => isFileSelected(file.id));
	const isSomeSelected = data.some((file: FileItem) => isFileSelected(file.id));

	const handleSelectAll = () => {
		if (isAllSelected) {
			deselectAllFiles();
		} else {
			selectAllFiles(data.map((file: FileItem) => file.id));
		}
	};

	const columnsWithSelection: ColumnDef<FileItem>[] = [
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
					checked={isFileSelected(row.original.id)}
					onCheckedChange={() => toggleFileSelection(row.original.id)}
					aria-label="Select row"
				/>
			),
			size: 40,
			enableSorting: false,
		},
		...columns,
	];

	const table = useReactTable({
		data,
		columns: columnsWithSelection,
		getCoreRowModel: getCoreRowModel(),
		enableSorting: false,
		getPaginationRowModel: getPaginationRowModel(),
		onPaginationChange: setPagination,
		manualPagination: true,
		rowCount: total,
		state: {
			pagination,
		},
	});

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-md border bg-background">
				<Table className="table-fixed">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => {
									const canSort =
										header.column.id !== "select" &&
										header.column.id !== "actions" &&
										header.column.id !== "thumbnail" &&
										data.length > 0; // Disable sorting when no files
									header.column.id !== "select" &&
										header.column.id !== "actions" &&
										header.column.id !== "thumbnail" &&
										data.length > 0; // Disable sorting when no files
									const sortState = canSort
										? getSortState(header.column.id)
										: false;
									return (
										<TableHead
											key={header.id}
											style={{ width: `${header.getSize()}px` }}
											className="h-12 px-4"
										>
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
													tabIndex={0}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
													{sortState === "asc" && (
														<ChevronUpIcon
															className="shrink-0 opacity-60"
															size={16}
															aria-hidden="true"
														/>
													)}
													{sortState === "desc" && (
														<ChevronDownIcon
															className="shrink-0 opacity-60"
															size={16}
															aria-hidden="true"
														/>
													)}
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
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
