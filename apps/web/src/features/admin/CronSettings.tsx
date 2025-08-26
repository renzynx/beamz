"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle,
	Clock,
	Play,
	RefreshCw,
	Square,
} from "lucide-react";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/client";

const cronSettingsSchema = z.object({
	cronEnabled: z.boolean(),
	completedJobsCleanupSchedule: z
		.string()
		.min(1, { message: "Schedule is required" }),
	expiredFilesCleanupSchedule: z
		.string()
		.min(1, { message: "Schedule is required" }),
	tempCleanupSchedule: z.string().min(1, { message: "Schedule is required" }),
	cronTimezone: z.string().min(1, { message: "Timezone is required" }),
});

type CronSettingsForm = z.infer<typeof cronSettingsSchema>;

export function CronSettings() {
	const id = useId();
	const trpc = useTRPC();

	const { data: currentRaw } = useSuspenseQuery(
		trpc.settings.get.queryOptions(),
	);

	const {
		data: cronStatus,
		isLoading: cronStatusLoading,
		refetch: refetchCronStatus,
	} = useQuery(trpc.cron.cronStatus.queryOptions());

	const settingsMutation = useMutation(trpc.settings.set.mutationOptions());
	const restartCronMutation = useMutation(
		trpc.cron.cronRestart.mutationOptions(),
	);
	const startCronMutation = useMutation(trpc.cron.cronStart.mutationOptions());
	const stopCronMutation = useMutation(trpc.cron.cronStop.mutationOptions());

	const form = useForm<CronSettingsForm>({
		resolver: zodResolver(cronSettingsSchema),
		defaultValues: {
			cronEnabled: true,
			completedJobsCleanupSchedule: "0 2 * * *",
			expiredFilesCleanupSchedule: "0 4 * * *",
			tempCleanupSchedule: "*/30 * * * *",
			cronTimezone: "UTC",
		},
	});

	const { handleSubmit, reset, watch } = form;
	const watchCronEnabled = watch("cronEnabled");

	useEffect(() => {
		if (!currentRaw) return;

		reset({
			cronEnabled: !!currentRaw.cronEnabled,
			completedJobsCleanupSchedule:
				currentRaw.completedJobsCleanupSchedule ?? "0 2 * * *",
			expiredFilesCleanupSchedule:
				currentRaw.expiredFilesCleanupSchedule ?? "0 4 * * *",
			tempCleanupSchedule: currentRaw.tempCleanupSchedule ?? "*/30 * * * *",
			cronTimezone: currentRaw.cronTimezone ?? "UTC",
		});
	}, [currentRaw, reset]);

	const onSubmit = handleSubmit(async (values) => {
		try {
			await settingsMutation.mutateAsync(values);
			refetchCronStatus();
			toast.success("Cron settings saved successfully");
		} catch (err: any) {
			console.error("Failed to save cron settings", err);
			toast.error(err?.message || "Failed to save cron settings");
		}
	});

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
					<div className="space-y-3 rounded-lg bg-muted p-4">
						<div className="flex items-center justify-between">
							<h4 className="font-medium">Service Status</h4>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetchCronStatus()}
								disabled={cronStatusLoading}
							>
								<RefreshCw
									className={`mr-2 size-4 ${cronStatusLoading ? "animate-spin" : ""}`}
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
								<Square className="mr-2 size-4" />
								{stopCronMutation.isPending ? "Stopping..." : "Stop Service"}
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={handleRestartCron}
								disabled={restartCronMutation.isPending}
							>
								<RefreshCw className="mr-2 size-4" />
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
							<Play className="mr-2 size-4" />
							{startCronMutation.isPending ? "Starting..." : "Start Service"}
						</Button>
					)}
				</div>

				<Form {...form}>
					<form onSubmit={onSubmit} className="space-y-6">
						<div className="flex items-center gap-3 border-b py-4">
							<FormField
								name="cronEnabled"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center gap-3">
											<FormControl>
												<Switch
													id={`${id}-cron-enabled`}
													checked={field.value}
													onCheckedChange={(v) => field.onChange(!!v)}
												/>
											</FormControl>
											<div className="space-y-1">
												<FormLabel>Enable Cron Service</FormLabel>
												<FormDescription>
													Enable automatic cleanup tasks and scheduled
													maintenance
												</FormDescription>
											</div>
										</div>
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<FormField
								name="completedJobsCleanupSchedule"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Completed Jobs Cleanup Schedule</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="0 2 * * *"
												disabled={!watchCronEnabled}
											/>
										</FormControl>
										<FormDescription>
											Cron schedule for cleaning up old completed jobs (default:
											daily at 2 AM)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								name="expiredFilesCleanupSchedule"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Expired Files Cleanup Schedule</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="0 4 * * *"
												disabled={!watchCronEnabled}
											/>
										</FormControl>
										<FormDescription>
											Cron schedule for deleting expired files from storage
											(default: daily at 4 AM)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								name="tempCleanupSchedule"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Temp Cleanup Schedule</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="*/30 * * * *"
												disabled={!watchCronEnabled}
											/>
										</FormControl>
										<FormDescription>
											Cron schedule for cleaning up temporary files (default:
											every 30 minutes)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								name="cronTimezone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Timezone</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="UTC"
												disabled={!watchCronEnabled}
											/>
										</FormControl>
										<FormDescription>
											Timezone for cron schedule execution (e.g., UTC,
											America/New_York)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="rounded-lg bg-muted p-4">
							<h4 className="mb-2 font-medium">Cron Schedule Format</h4>
							<p className="mb-2 text-muted-foreground text-sm">
								Use standard cron format:{" "}
								<code>minute hour day month weekday</code>
							</p>
							<div className="space-y-1 text-muted-foreground text-sm">
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
								{settingsMutation.isPending
									? "Saving..."
									: "Save Cron Settings"}
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
