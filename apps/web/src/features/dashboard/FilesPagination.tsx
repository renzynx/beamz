"use client";

import { Label } from "@radix-ui/react-label";
import {
	ChevronFirstIcon,
	ChevronLastIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
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
import { useFilesContext } from "../../contexts/FilesContext";

export function FilesPagination({ total }: { total: number }) {
	const id = useId();
	const { pagination, setPagination } = useFilesContext();

	const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

	const firstPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	const previousPage = () =>
		setPagination((prev) => ({
			...prev,
			pageIndex: Math.max(0, prev.pageIndex - 1),
		}));
	const nextPage = () =>
		setPagination((prev) => ({ ...prev, pageIndex: prev.pageIndex + 1 }));
	const lastPage = () =>
		setPagination((prev) => ({
			...prev,
			pageIndex: Math.max(0, pageCount - 1),
		}));

	const internalCanPrevious = pagination.pageIndex > 0;
	const internalCanNext = pagination.pageIndex + 1 < pageCount;

	return (
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
						{Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)}
					</span>
					{" of "}
					<span className="text-foreground">{total}</span>
					{" • Page "}
					<span className="text-foreground">{pagination.pageIndex + 1}</span>
					{" of "}
					<span className="text-foreground">{pageCount}</span>
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
								onClick={firstPage}
								disabled={!internalCanPrevious}
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
								onClick={previousPage}
								disabled={!internalCanPrevious}
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
								onClick={nextPage}
								disabled={!internalCanNext}
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
								onClick={lastPage}
								disabled={!internalCanNext}
								aria-label="Go to last page"
							>
								<ChevronLastIcon size={16} aria-hidden="true" />
							</Button>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</div>
		</div>
	);
}
