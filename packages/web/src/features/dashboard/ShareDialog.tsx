"use client";

import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { FileItem } from "@/trpc/types";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { prefixWithCdn } from "./lib/utils";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems?: FileItem[];
}

export function ShareDialog({
  open,
  onOpenChange,
  selectedItems,
}: ShareDialogProps) {
  const trpc = useTRPC();
  const { data: settings } = useSuspenseQuery(
    trpc.settings.public.queryOptions()
  );
  const [isCopying, setIsCopying] = useState(false);
  const value = React.useMemo(() => {
    const items =
      selectedItems && selectedItems.length > 0 ? selectedItems : [];

    if (items.length === 0)
      return "No file objects available for selected files.";

    const urls = items.map((f) => {
      const ext = f.originalName.split(".").pop();
      const slug = `${f.key}.${ext}`;

      return prefixWithCdn(
        `/api/f/${slug}`,
        settings?.cdnUrl || window.location.origin
      );
    });

    // Return one URL per line for easier copying/sharing
    return urls.join("\n");
  }, [selectedItems]);

  const handleCopy = useCallback(async () => {
    if (!value || value.startsWith("No file objects")) return;
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(value);
      toast.success("Download URLs copied to clipboard");
    } catch (err) {
      console.error("Failed to copy URLs:", err);
      toast.error("Failed to copy to clipboard");
    } finally {
      setIsCopying(false);
    }
  }, [value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share download URLs</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <Textarea className="min-h-48 resize-none" readOnly value={value} />
        </div>

        <DialogFooter>
          <div className="w-full flex justify-end">
            <Button
              onClick={handleCopy}
              disabled={
                isCopying || !value || value.startsWith("No file objects")
              }
            >
              {isCopying ? "Copying..." : "Copy URLs"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
