"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import BackgroundJobsDeleteDialog from "./BackgroundJobsDeleteDialog";

interface Props {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BackgroundJobsActionBar({
  selectedIds,
  onClearSelection,
}: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  const bulkDeleteMutation = useMutation(
    trpc.jobs.bulkDelete.mutationOptions({
      onSuccess: (res) => {
        toast.success(res.message || "Deleted jobs");
        queryClient.invalidateQueries({
          queryKey: trpc.jobs.listJobs.queryKey(),
          exact: false,
        });
        onClearSelection();
      },
      onError: (err) => {
        toast.error(`Failed to delete jobs: ${err.message}`);
      },
    }),
  );

  const openConfirm = () => {
    if (selectedIds.length === 0) return;
    setOpen(true);
  };

  const performDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkDeleteMutation.mutateAsync({ jobIds: selectedIds });
    } finally {
      setOpen(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div
        className={
          "-translate-x-1/2 fixed top-4 left-1/2 z-50 transform" +
          "rounded-lg border bg-background/80 px-4 py-3 text-foreground shadow-lg backdrop-blur-md" +
          "slide-in-from-top-2 mx-4 w-full max-w-2xl animate-in duration-300 ease-out"
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-medium text-sm">
              {selectedIds.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={openConfirm}>
              <Trash size={16} className="mr-2" />
              Delete
            </Button>

            <Button size="sm" variant="ghost" onClick={onClearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <BackgroundJobsDeleteDialog
        open={open}
        setOpen={setOpen}
        selectedCount={selectedIds.length}
        onConfirm={performDelete}
        isPending={bulkDeleteMutation.isPending}
      />
    </>
  );
}
