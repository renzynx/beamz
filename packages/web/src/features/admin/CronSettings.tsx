"use client";

import { useId, useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import z from "zod";

const cronSettingsSchema = z.object({
  cronEnabled: z.boolean(),
  completedJobsCleanupSchedule: z
    .string()
    .min(1, { message: "Schedule is required" }),
  expiredFilesCleanupSchedule: z
    .string()
    .min(1, { message: "Schedule is required" }),
  tempCleanupSchedule: z.string().min(1, { message: "Schedule is required" }),
  cronLogLevel: z.enum(["debug", "info", "warn", "error"]),
  cronTimezone: z.string().min(1, { message: "Timezone is required" }),
});

const mapZodErrors = (err: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path?.[0] ?? "");
    out[key] = issue.message;
  }
  return out;
};

export function CronSettings() {
  const id = useId();
  const trpc = useTRPC();

  const { data: currentRaw } = useSuspenseQuery(
    trpc.settings.get.queryOptions()
  );

  const {
    data: cronStatus,
    isLoading: cronStatusLoading,
    refetch: refetchCronStatus,
  } = useQuery(trpc.cron.cronStatus.queryOptions());

  // Cron settings state
  const [cronEnabled, setCronEnabled] = useState<boolean>(true);
  const [completedJobsCleanupSchedule, setCompletedJobsCleanupSchedule] =
    useState<string>("0 2 * * *");
  const [expiredFilesCleanupSchedule, setExpiredFilesCleanupSchedule] =
    useState<string>("0 4 * * *");
  const [tempCleanupSchedule, setTempCleanupSchedule] =
    useState<string>("*/30 * * * *");
  const [cronLogLevel, setCronLogLevel] = useState<string>("info");
  const [cronTimezone, setCronTimezone] = useState<string>("UTC");

  const settingsMutation = useMutation(trpc.settings.set.mutationOptions());
  const restartCronMutation = useMutation(
    trpc.cron.cronRestart.mutationOptions()
  );
  const startCronMutation = useMutation(trpc.cron.cronStart.mutationOptions());
  const stopCronMutation = useMutation(trpc.cron.cronStop.mutationOptions());

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentRaw) return;

    setCronEnabled(!!currentRaw.cronEnabled);
    setCompletedJobsCleanupSchedule(
      currentRaw.completedJobsCleanupSchedule ?? "0 2 * * *"
    );
    setExpiredFilesCleanupSchedule(
      currentRaw.expiredFilesCleanupSchedule ?? "0 4 * * *"
    );
    setTempCleanupSchedule(currentRaw.tempCleanupSchedule ?? "*/30 * * * *");
    setCronLogLevel(currentRaw.cronLogLevel ?? "info");
    setCronTimezone(currentRaw.cronTimezone ?? "UTC");
  }, [currentRaw]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = cronSettingsSchema.safeParse({
      cronEnabled,
      completedJobsCleanupSchedule,
      expiredFilesCleanupSchedule,
      tempCleanupSchedule,
      cronLogLevel,
      cronTimezone,
    });

    if (!parsed.success) {
      const mapped = mapZodErrors(parsed.error);
      setErrors(mapped);
      toast.error("Please fix validation errors before saving");
      return;
    }

    setErrors({});

    try {
      await settingsMutation.mutateAsync({
        cronEnabled,
        completedJobsCleanupSchedule,
        expiredFilesCleanupSchedule,
        tempCleanupSchedule,
        cronLogLevel,
        cronTimezone,
      });

      // Refresh cron status after saving settings
      refetchCronStatus();

      toast.success("Cron settings saved successfully");
    } catch (err: any) {
      console.error("Failed to save cron settings", err);
      toast.error(err?.message || "Failed to save cron settings");
    }
  };

  const handleRestartCron = async () => {
    try {
      const result = await restartCronMutation.mutateAsync();
      toast.success(result.message);
      refetchCronStatus();
    } catch (err: any) {
      console.error("Cron restart failed", err);
      toast.error(err?.message || "Failed to restart cron service");
    }
  };

  const handleStartCron = async () => {
    try {
      const result = await startCronMutation.mutateAsync();
      toast.success(result.message);
      refetchCronStatus();
    } catch (err: any) {
      console.error("Cron start failed", err);
      toast.error(err?.message || "Failed to start cron service");
    }
  };

  const handleStopCron = async () => {
    try {
      const result = await stopCronMutation.mutateAsync();
      toast.success(result.message);
      refetchCronStatus();
    } catch (err: any) {
      console.error("Cron stop failed", err);
      toast.error(err?.message || "Failed to stop cron service");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cron Service Settings
          {cronStatus && (
            <Badge
              variant={cronStatus.running ? "default" : "destructive"}
              className="ml-2"
            >
              {cronStatus.running ? "Running" : "Stopped"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure automated cleanup schedules and cron service behavior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cron Status Display */}
        {cronStatus && (
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Service Status</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchCronStatus()}
                disabled={cronStatusLoading}
              >
                <RefreshCw
                  className={`size-4 mr-2 ${cronStatusLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {cronStatus.enabled ? (
                    <CheckCircle className="size-4 text-green-500" />
                  ) : (
                    <AlertCircle className="size-4 text-orange-500" />
                  )}
                  <span>Enabled: {cronStatus.enabled ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {cronStatus.running ? (
                    <Play className="size-4 text-green-500" />
                  ) : (
                    <Square className="size-4 text-red-500" />
                  )}
                  <span>Running: {cronStatus.running ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {cronStatus.controlServerRunning ? (
                    <CheckCircle className="size-4 text-green-500" />
                  ) : (
                    <AlertCircle className="size-4 text-orange-500" />
                  )}
                  <span>
                    Control Server:{" "}
                    {cronStatus.controlServerRunning ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-blue-500" />
                  <span>
                    Job Cleanup: {cronStatus.completedJobsJob.schedule}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-blue-500" />
                  <span>
                    Temp Cleanup: {cronStatus.tempCleanupJob.schedule}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {cronStatus?.running ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopCron}
                disabled={stopCronMutation.isPending}
              >
                <Square className="size-4 mr-2" />
                {stopCronMutation.isPending ? "Stopping..." : "Stop Service"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRestartCron}
                disabled={restartCronMutation.isPending}
              >
                <RefreshCw className="size-4 mr-2" />
                {restartCronMutation.isPending
                  ? "Restarting..."
                  : "Restart Service"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartCron}
              disabled={startCronMutation.isPending}
            >
              <Play className="size-4 mr-2" />
              {startCronMutation.isPending ? "Starting..." : "Start Service"}
            </Button>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="flex items-center gap-3 py-4 border-b">
            <Switch
              id={`${id}-cron-enabled`}
              checked={cronEnabled}
              onCheckedChange={(v) => setCronEnabled(!!v)}
            />
            <div className="space-y-1">
              <Label htmlFor={`${id}-cron-enabled`}>Enable Cron Service</Label>
              <p className="text-sm text-muted-foreground">
                Enable automatic cleanup tasks and scheduled maintenance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-completed-jobs-schedule`}>
                Completed Jobs Cleanup Schedule
              </Label>
              <Input
                id={`${id}-completed-jobs-schedule`}
                value={completedJobsCleanupSchedule}
                onChange={(e) =>
                  setCompletedJobsCleanupSchedule(e.target.value)
                }
                placeholder="0 2 * * *"
                disabled={!cronEnabled}
              />
              {errors.completedJobsCleanupSchedule && (
                <div className="text-sm text-destructive mt-1">
                  {errors.completedJobsCleanupSchedule}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Cron schedule for cleaning up old completed jobs (default: daily
                at 2 AM)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-expired-files-schedule`}>
                Expired Files Cleanup Schedule
              </Label>
              <Input
                id={`${id}-expired-files-schedule`}
                value={expiredFilesCleanupSchedule}
                onChange={(e) => setExpiredFilesCleanupSchedule(e.target.value)}
                placeholder="0 4 * * *"
                disabled={!cronEnabled}
              />
              {errors.expiredFilesCleanupSchedule && (
                <div className="text-sm text-destructive mt-1">
                  {errors.expiredFilesCleanupSchedule}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Cron schedule for deleting expired files from storage (default:
                daily at 4 AM)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-temp-schedule`}>
                Temp Cleanup Schedule
              </Label>
              <Input
                id={`${id}-temp-schedule`}
                value={tempCleanupSchedule}
                onChange={(e) => setTempCleanupSchedule(e.target.value)}
                placeholder="*/30 * * * *"
                disabled={!cronEnabled}
              />
              {errors.tempCleanupSchedule && (
                <div className="text-sm text-destructive mt-1">
                  {errors.tempCleanupSchedule}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Cron schedule for cleaning up temporary files (default: every 30
                minutes)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-log-level`}>Log Level</Label>
              <Select
                value={cronLogLevel}
                onValueChange={(value) => setCronLogLevel(value)}
                disabled={!cronEnabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select log level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              {errors.cronLogLevel && (
                <div className="text-sm text-destructive mt-1">
                  {errors.cronLogLevel}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-timezone`}>Timezone</Label>
              <Input
                id={`${id}-timezone`}
                value={cronTimezone}
                onChange={(e) => setCronTimezone(e.target.value)}
                placeholder="UTC"
                disabled={!cronEnabled}
              />
              {errors.cronTimezone && (
                <div className="text-sm text-destructive mt-1">
                  {errors.cronTimezone}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Timezone for cron schedule execution (e.g., UTC,
                America/New_York)
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Cron Schedule Format</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Use standard cron format:{" "}
              <code>minute hour day month weekday</code>
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                <code>0 2 * * *</code> - Daily at 2:00 AM
              </div>
              <div>
                <code>*/30 * * * *</code> - Every 30 minutes
              </div>
              <div>
                <code>0 */6 * * *</code> - Every 6 hours
              </div>
              <div>
                <code>0 0 * * 0</code> - Weekly on Sunday at midnight
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={settingsMutation.isPending}>
              {settingsMutation.isPending ? "Saving..." : "Save Cron Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
