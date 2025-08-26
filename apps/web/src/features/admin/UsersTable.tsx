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
import { toast } from "sonner";
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
import { authClient } from "@/lib/auth";
import { useTRPC } from "@/trpc/client";
import type { UserItem } from "@/trpc/types";
import { useUsersContext } from "../../contexts/UsersContext";
import { BanUserDialog } from "./BanUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { createUserColumns } from "./UsersTableColumns";

export function UsersTable() {
	const trpc = useTRPC();
	const {
		pagination,
		setPagination,
		sortBy,
		sortDir,
		setSortBy,
		setSortDir,
		selectAllUsers,
		deselectAllUsers,
		toggleUserSelection,
		isUserSelected,
	} = useUsersContext();
	const {
		data: { data, total, hasNextPage },
		refetch,
	} = useSuspenseQuery(
		trpc.admin.getUsers.queryOptions({
			offset: pagination.pageIndex * pagination.pageSize,
			limit: pagination.pageSize,
			sortBy,
			sortDir,
		}),
	);

	const id = useId();

	// Ban dialog state
	const [banDialogOpen, setBanDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

	// Edit dialog state
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editUser, setEditUser] = useState<UserItem | null>(null);

	// Action handlers
	const handleBanUser = (user: UserItem) => {
		setSelectedUser(user);
		setBanDialogOpen(true);
	};

	const handleUnbanUser = async (user: UserItem) => {
		await authClient.admin.unbanUser({ userId: user.id });

		await refetch();

		toast.success(`${user.name} has been unbanned`);
	};

	const handleEditUser = (user: UserItem) => {
		setEditUser(user);
		setEditDialogOpen(true);
	};

	const handleBanUserSubmit = async (
		userId: string,
		banReason?: string,
		banExpiresIn?: number,
	) => {
		await authClient.admin.banUser({ userId, banReason, banExpiresIn });

		await refetch();
	};

	const handleEditUserSubmit = async (
		userId: string,
		data: {
			name: string;
			email: string;
			quota?: number;
		},
	) => {
		await authClient.admin.updateUser({
			userId,
			data: {
				name: data.name,
				email: data.email,
				quota: data.quota,
			},
		});

		await refetch();
	};

	const userColumns = createUserColumns({
		onBanUser: handleBanUser,
		onUnbanUser: handleUnbanUser,
		onEditUser: handleEditUser,
	});

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
		data.length > 0 && data.every((user: UserItem) => isUserSelected(user.id));
	const isSomeSelected = data.some((user: UserItem) => isUserSelected(user.id));

	const handleSelectAll = () => {
		if (isAllSelected) {
			deselectAllUsers();
		} else {
			selectAllUsers(data.map((user: UserItem) => user.id));
		}
	};

	const columnsWithSelection: ColumnDef<UserItem>[] = [
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
					checked={isUserSelected(row.original.id)}
					onCheckedChange={() => toggleUserSelection(row.original.id)}
					aria-label="Select row"
				/>
			),
			size: 40,
			enableSorting: false,
		},
		...userColumns,
	];

	const table = useReactTable({
		data,
		columns: columnsWithSelection,
		getCoreRowModel: getCoreRowModel(),
		// Disable sorting since it's handled by parent
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
										data.length > 0; // Disable sorting when no users
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
									colSpan={userColumns.length + 1}
									className="h-24 px-4 py-3 text-center"
								>
									No users found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between gap-8">
				{/* Results per page */}
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
				{/* Page number information */}
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
				{/* Pagination buttons */}
				<div>
					<Pagination>
						<PaginationContent>
							{/* First page button */}
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
							{/* Previous page button */}
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
							{/* Next page button */}
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
							{/* Last page button */}
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

			{/* Ban User Dialog */}
			<BanUserDialog
				open={banDialogOpen}
				onOpenChange={setBanDialogOpen}
				user={selectedUser}
				onBanUser={handleBanUserSubmit}
			/>

			{/* Edit User Dialog */}
			<EditUserDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				user={editUser}
				onEditUser={handleEditUserSubmit}
			/>
		</div>
	);
}
