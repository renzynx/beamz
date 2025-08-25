"use client";

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
import { useFilesContext } from "../../contexts/FilesContext";

export function DeleteConfirmationDialog() {
  const {
    fileToDelete,
    filesToDelete,
    setFileToDelete,
    setFilesToDelete,
    confirmDelete,
    isDeletingFile,
  } = useFilesContext();

  const isOpen = !!fileToDelete || filesToDelete.length > 0;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFileToDelete(null);
      setFilesToDelete([]);
    }
  };

  const getDialogContent = () => {
    if (fileToDelete) {
      return {
        title: "Delete File",
        description: `Are you sure you want to delete "${fileToDelete.originalName}"? This action cannot be undone.`,
      };
    } else if (filesToDelete.length > 0) {
      return {
        title: "Delete Files",
        description: `Are you sure you want to delete ${filesToDelete.length} file${filesToDelete.length === 1 ? "" : "s"}? This action cannot be undone.`,
      };
    }
    return { title: "", description: "" };
  };

  const content = getDialogContent();

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingFile}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={isDeletingFile}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingFile ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
