"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import type { FileItem } from "@/trpc/types";

export type ViewType = "table" | "grid";
export type SortByType = "createdAt" | "originalName" | "size" | "mimeType";
export type SortDirType = "asc" | "desc";

interface FilesContextType {
	// Pagination state
	pagination: PaginationState;
	setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;

	// Sorting state
	sortBy: SortByType;
	sortDir: SortDirType;
	setSortBy: (sortBy: SortByType) => void;
	setSortDir: (sortDir: SortDirType) => void;

	// Selection state
	selectedFiles: Set<string>;
	setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
	selectFile: (fileId: string) => void;
	deselectFile: (fileId: string) => void;
	toggleFileSelection: (fileId: string) => void;
	selectAllFiles: (fileIds: string[]) => void;
	deselectAllFiles: () => void;
	isFileSelected: (fileId: string) => boolean;

	// Actions
	downloadFile: (file: FileItem) => void;
	regenerateThumbnail: (file: FileItem) => void;
	handleDeleteFile: (file: FileItem) => void;
	handleDeleteFiles: (fileIds: string[]) => void;
	handleDeleteSelectedFiles: () => void;
	isRegeneratingThumbnail: boolean;
	isDeletingFile: boolean;

	// Properties dialog state
	propertiesFile: FileItem | null;
	setPropertiesFile: (file: FileItem | null) => void;
	showProperties: (file: FileItem) => void;

	// Preview dialog state
	previewFile: FileItem | null;
	setPreviewFile: (file: FileItem | null) => void;
	showPreview: (file: FileItem) => void;

	// Delete confirmation state
	fileToDelete: FileItem | null;
	setFileToDelete: (file: FileItem | null) => void;
	filesToDelete: string[];
	setFilesToDelete: (fileIds: string[]) => void;
	showDeleteConfirmation: (file: FileItem) => void;
	showBulkDeleteConfirmation: (fileIds: string[]) => void;
	confirmDelete: () => void;

	// Helper to update query params
	updateQueryParams: (updates: Record<string, string | null>) => void;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

export function useFilesContext() {
	const context = useContext(FilesContext);
	if (!context) {
		throw new Error("useFilesContext must be used within a FilesProvider");
	}
	return context;
}

interface FilesProviderProps {
	children: React.ReactNode;
}

export function FilesProvider({ children }: FilesProviderProps) {
	// router helpers must be available before we read query params
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	// Initialize pagination from query params (page is 1-based in the URL)
	const paramPage = searchParams?.get("page");
	const paramPageSize = searchParams?.get("pageSize");
	const initialPageIndex = paramPage
		? Math.max(0, Number.parseInt(paramPage as string, 10) - 1)
		: 0;
	const initialPageSize = paramPageSize
		? Math.max(1, Number.parseInt(paramPageSize as string, 10))
		: 20;

	const [paginationState, setPaginationState] = useState<PaginationState>({
		pageIndex: initialPageIndex,
		pageSize: initialPageSize,
	});

	const [propertiesFile, setPropertiesFile] = useState<FileItem | null>(null);
	const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

	const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
	const [filesToDelete, setFilesToDelete] = useState<string[]>([]);

	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const regenerateThumbnailMutation = useMutation(
		trpc.files.regenerateThumbnail.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({
					queryKey: trpc.files.get.queryKey(),
					exact: false,
					refetchType: "active",
				});
				toast.success(data.message);
			},
			onError: (error) => {
				toast.error(`Failed to regenerate thumbnail: ${error.message}`);
			},
		}),
	);

	const deleteFileMutation = useMutation(
		trpc.files.delete.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({
					queryKey: trpc.files.get.queryKey(),
					exact: false,
					refetchType: "active",
				});

				toast.success(data.message);
			},
			onError: (error) => {
				toast.error(`Failed to delete files: ${error.message}`);
			},
		}),
	);

	const paramSortBy = searchParams?.get("sortBy") ?? undefined;
	const allowedSortBy = new Set<SortByType>([
		"createdAt",
		"originalName",
		"size",
		"mimeType",
	]);
	const initialSortBy = allowedSortBy.has(paramSortBy as SortByType)
		? (paramSortBy as SortByType)
		: "createdAt";

	const paramSortDir = searchParams?.get("sortDir");
	const initialSortDir: SortDirType = paramSortDir === "asc" ? "asc" : "desc";

	const [sortBy, setSortByState] = useState<SortByType>(initialSortBy);
	const [sortDir, setSortDirState] = useState<SortDirType>(initialSortDir);

	const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

	const selectFile = (fileId: string) => {
		setSelectedFiles((prev) => new Set([...prev, fileId]));
	};

	const deselectFile = (fileId: string) => {
		setSelectedFiles((prev) => {
			const newSet = new Set(prev);
			newSet.delete(fileId);
			return newSet;
		});
	};

	const toggleFileSelection = (fileId: string) => {
		setSelectedFiles((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(fileId)) {
				newSet.delete(fileId);
			} else {
				newSet.add(fileId);
			}
			return newSet;
		});
	};

	const selectAllFiles = (fileIds: string[]) => {
		setSelectedFiles(new Set(fileIds));
	};

	const deselectAllFiles = () => {
		setSelectedFiles(new Set());
	};

	const isFileSelected = (fileId: string) => {
		return selectedFiles.has(fileId);
	};

	// Use a queued pendingQuery so we don't call router.replace during render.
	const [pendingQuery, setPendingQuery] = useState<string | null>(null);

	const updateQueryParams = (updates: Record<string, string | null>) => {
		const params = new URLSearchParams(
			Array.from(searchParams?.entries() ?? []),
		);
		Object.entries(updates).forEach(([k, v]) => {
			if (v == null) params.delete(k);
			else params.set(k, v);
		});
		const qs = params.toString();
		// enqueue the new query string; the actual navigation will happen in an effect
		setPendingQuery(qs);
	};

	// Perform navigation as a side-effect (after render) to avoid setState during render
	useEffect(() => {
		if (pendingQuery === null) return;
		// call router.replace once pendingQuery is set
		router.replace(`${pathname}${pendingQuery ? `?${pendingQuery}` : ""}`);
		// clear pending
		setPendingQuery(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingQuery]);

	const setSortBy = (newSortBy: SortByType) => {
		setSortByState(newSortBy);
		updateQueryParams({ sortBy: newSortBy });
		setPagination((p) => ({ ...p, pageIndex: 0 }));
	};

	const setSortDir = (newSortDir: SortDirType) => {
		setSortDirState(newSortDir);
		updateQueryParams({ sortDir: newSortDir });
		// reset to first page when sort direction changes
		setPagination((p) => ({ ...p, pageIndex: 0 }));
	};

	const downloadFile = (file: FileItem) => {
		const link = document.createElement("a");
		link.href = `/api/f/${file.key}.${file.originalName.split(".").pop()}`;
		link.download = file.originalName;
		link.target = "_blank";
		link.style.display = "none";

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const regenerateThumbnail = async (file: FileItem) => {
		await regenerateThumbnailMutation.mutateAsync({ fileId: file.id });
	};

	const deleteFile = async (file: FileItem) => {
		await deleteFileMutation.mutateAsync({ fileIds: [file.id] });
	};

	const deleteFiles = async (fileIds: string[]) => {
		await deleteFileMutation.mutateAsync({ fileIds });
	};

	const deleteSelectedFiles = async () => {
		const fileIds = Array.from(selectedFiles);
		if (fileIds.length > 0) {
			await deleteFiles(fileIds);
			deselectAllFiles();
		}
	};

	const showDeleteConfirmation = (file: FileItem) => {
		setFileToDelete(file);
		setFilesToDelete([]);
	};

	const showBulkDeleteConfirmation = (fileIds: string[]) => {
		setFilesToDelete(fileIds);
		setFileToDelete(null);
	};

	const confirmDelete = () => {
		if (fileToDelete) {
			deleteFile(fileToDelete);
			setFileToDelete(null);
		} else if (filesToDelete.length > 0) {
			deleteFiles(filesToDelete);
			setFilesToDelete([]);
			deselectAllFiles();
		}
	};

	const showProperties = (file: FileItem) => {
		setPropertiesFile(file);
	};

	const showPreview = (file: FileItem) => {
		setPreviewFile(file);
	};

	// Wrapper that persists pagination changes to the URL query params.
	// Exposed as `setPagination` in the context so consumers can call it as usual.
	const setPagination: React.Dispatch<React.SetStateAction<PaginationState>> = (
		updater,
	) => {
		setPaginationState((prev) => {
			const newP =
				typeof updater === "function"
					? (updater as (p: PaginationState) => PaginationState)(prev)
					: updater;
			// persist 1-based page index for the query string
			updateQueryParams({
				page: (newP.pageIndex + 1).toString(),
				pageSize: newP.pageSize.toString(),
			});
			return newP;
		});
	};

	const value: FilesContextType = {
		pagination: paginationState,
		setPagination,
		sortBy,
		sortDir,
		setSortBy,
		setSortDir,
		selectedFiles,
		setSelectedFiles,
		selectFile,
		deselectFile,
		toggleFileSelection,
		selectAllFiles,
		deselectAllFiles,
		isFileSelected,
		downloadFile,
		regenerateThumbnail,
		handleDeleteFile: deleteFile,
		handleDeleteFiles: deleteFiles,
		handleDeleteSelectedFiles: deleteSelectedFiles,
		isRegeneratingThumbnail: regenerateThumbnailMutation.isPending,
		isDeletingFile: deleteFileMutation.isPending,
		propertiesFile,
		setPropertiesFile,
		showProperties,
		previewFile,
		setPreviewFile,
		showPreview,
		fileToDelete,
		setFileToDelete,
		filesToDelete,
		setFilesToDelete,
		showDeleteConfirmation,
		showBulkDeleteConfirmation,
		confirmDelete,
		updateQueryParams,
	};

	return (
		<FilesContext.Provider value={value}>{children}</FilesContext.Provider>
	);
}
