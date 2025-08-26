"use client";

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import React, { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";
import { MetricCard } from "@/components/MetricCard";
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
import { formatFileSize } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

export function MetricsContent() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [days, setDays] = useState<number>(7);

	const { data } = useSuspenseQuery(
		trpc.metrics.overview.queryOptions({ days }),
	);

	// Fetch previous period data for comparison
	const { data: previousData } = useSuspenseQuery(
		trpc.metrics.overview.queryOptions({ days: days * 2 }),
	);

	const revalidateMutation = useMutation(
		trpc.metrics.revalidate.mutationOptions({
			onSuccess: (res) => {
				toast.success(`Cache cleared (${res.cleared})`);
				// Invalidate the metrics overview for the selected days so it refetches
				queryClient.invalidateQueries({
					queryKey: trpc.metrics.overview.queryKey({ days }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.metrics.overview.queryKey({ days: days * 2 }),
				});
			},
			onError: (err: any) => {
				toast.error(`Failed to revalidate metrics: ${err?.message || err}`);
			},
		}),
	);

	if (!data) return <div>Loading metrics...</div>;

	const uploads = data.uploadsPerDay
		.slice()
		.reverse()
		.map((d) => ({ day: d.day, uploads: d.total }));

	const signups = data.signupsPerDay
		.slice()
		.reverse()
		.map((d) => ({ day: d.day, signups: d.total }));

	const jobsStatus = data.jobsByStatus.map((j) => ({
		status: j.status,
		total: j.total,
	}));
	const usersByRole = data.usersByRole.map((u) => ({
		role: u.role ?? "unknown",
		total: u.total,
	}));

	const handleRevalidate = async () => {
		try {
			await revalidateMutation.mutateAsync({ days: [days, days * 2] });
		} catch (err) {
			// handled in mutation callbacks
		}
	};

	// Calculate previous period totals for comparison
	const getPreviousPeriodTotal = (
		currentTotal: number,
		previousTotal: number,
	) => {
		// Since previousData covers 2x the period, we estimate the previous period
		// by subtracting current from total and assuming linear distribution
		const estimatedPrevious = Math.max(0, previousTotal - currentTotal);
		return estimatedPrevious;
	};

	const previousFiles = previousData
		? getPreviousPeriodTotal(data.totalFiles, previousData.totalFiles)
		: undefined;
	const previousJobs = previousData
		? getPreviousPeriodTotal(data.totalJobs, previousData.totalJobs)
		: undefined;
	const previousUsers = previousData
		? getPreviousPeriodTotal(data.totalUsers, previousData.totalUsers)
		: undefined;
	const previousStorage = previousData
		? getPreviousPeriodTotal(
				data.totalStorageBytes,
				previousData.totalStorageBytes,
			)
		: undefined;

	return (
		<div className="space-y-6 text-sm">
			<Card>
				<CardHeader>
					<CardTitle>Metrics</CardTitle>
					<CardDescription>
						Overview of uploads, users and background jobs
					</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground text-sm">Show last</span>
						<Select
							value={String(days)}
							onValueChange={(v) => setDays(Number(v))}
						>
							<SelectTrigger size="sm" className="w-28">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={"7"}>7 days</SelectItem>
								<SelectItem value={"30"}>30 days</SelectItem>
								<SelectItem value={"90"}>90 days</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={handleRevalidate}
							disabled={revalidateMutation.isPending}
						>
							<RefreshCw
								className={`mr-2 size-4 ${revalidateMutation.isPending ? "animate-spin" : ""}`}
							/>
							{revalidateMutation.isPending ? "Clearing..." : "Revalidate"}
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					title="Total Files"
					value={data.totalFiles}
					previousValue={previousFiles}
				/>

				<MetricCard
					title="Total Storage"
					value={data.totalStorageBytes}
					previousValue={previousStorage}
					formatValue={(bytes) => formatFileSize(bytes)}
				/>

				<MetricCard
					title="Background Jobs"
					value={data.totalJobs}
					previousValue={previousJobs}
				/>

				<MetricCard
					title="Total Users"
					value={data.totalUsers}
					previousValue={previousUsers}
				/>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card className="overflow-hidden">
					<CardContent>
						<p className="mb-2 font-medium text-xs">Uploads (per day)</p>
						<div className="h-[220px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart
									data={uploads}
									margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="day" tick={{ fontSize: 12 }} />
									<YAxis />
									<Tooltip />
									<Line
										type="monotone"
										dataKey="uploads"
										stroke="var(--color-chart-1)"
										strokeWidth={2}
										dot={{ r: 2 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardContent>
						<h3 className="mb-2 font-medium text-sm">Signups (per day)</h3>
						<div className="h-[220px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart
									data={signups}
									margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="day" tick={{ fontSize: 12 }} />
									<YAxis />
									<Tooltip />
									<Line
										type="monotone"
										dataKey="signups"
										stroke="var(--color-chart-2)"
										strokeWidth={2}
										dot={{ r: 2 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Card className="overflow-hidden">
					<CardContent>
						<h3 className="mb-2 font-medium text-sm">Jobs by Status</h3>
						<div className="h-[240px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={jobsStatus}
									margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="status" />
									<YAxis />
									<Tooltip />
									<Legend />
									<Bar
										name="jobs"
										dataKey="total"
										fill="var(--color-chart-3)"
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardContent>
						<h3 className="mb-2 font-medium text-sm">Users by Role</h3>
						<div className="h-[240px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={usersByRole}
									margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="role" />
									<YAxis />
									<Tooltip />
									<Legend />
									<Bar
										name="users"
										dataKey="total"
										fill="var(--color-chart-4)"
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
