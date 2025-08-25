"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export default function BackgroundJobsHeader() {
  const trpc = useTRPC();
  const [days, setDays] = useState<number>(7);

  const mutation = useMutation(
    trpc.jobs.cleanup.mutationOptions({
      onSuccess: (res) => {
        toast.success(res.message || "Jobs cleanup queued");
      },
      onError: (err) => {
        toast.error(`Cleanup failed: ${err.message}`);
      },
    })
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await mutation.mutateAsync({ olderThanDays: days });
  };

  return (
    <div className="flex justify-between w-full mb-4">
      <h2 className="text-lg font-medium">Background Jobs</h2>

      <Popover>
        <PopoverTrigger asChild>
          <Button>Clean Up Jobs</Button>
        </PopoverTrigger>
        <PopoverContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="days">Remove jobs older than (days)</Label>
              <Input
                name="days"
                type="number"
                min={1}
                value={String(days)}
                onChange={(e) =>
                  setDays(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="mr-2">
                Run
              </Button>
              <Button variant="ghost" onClick={() => setDays(7)}>
                Reset
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
