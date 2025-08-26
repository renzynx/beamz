"use client";

import React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
	open: boolean;
	setOpen: (v: boolean) => void;
	selectedCount: number;
	onConfirm: () => Promise<void> | void;
	isPending: boolean;
}

export default function BackgroundJobsDeleteDialog({
	open,
	setOpen,
	selectedCount,
	onConfirm,
	isPending,
}: Props) {
	return (
		<AlertDialog open={open} onOpenChange={(v) => setOpen(v)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Jobs</AlertDialogTitle>
					<AlertDialogDescription>
						{`Are you sure you want to delete ${selectedCount} job${
							selectedCount === 1 ? "" : "s"
						}? This action cannot be undone.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
