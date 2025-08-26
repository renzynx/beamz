"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UserItem } from "@/trpc/types";

const banUserSchema = z.object({
	banReason: z
		.string()
		.max(500, "Ban reason must be 500 characters or less")
		.optional(),
	banDuration: z.enum(["1h", "1d", "1w", "1m", "permanent"]),
});

type BanUserFormData = z.infer<typeof banUserSchema>;

interface BanUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: UserItem | null;
	onBanUser: (
		userId: string,
		banReason?: string,
		banExpiresIn?: number,
	) => Promise<void>;
}

const durationOptions = [
	{ value: "1h", label: "1 Hour", seconds: 60 * 60 },
	{ value: "1d", label: "1 Day", seconds: 60 * 60 * 24 },
	{ value: "1w", label: "1 Week", seconds: 60 * 60 * 24 * 7 },
	{ value: "1m", label: "1 Month", seconds: 60 * 60 * 24 * 30 },
	{ value: "permanent", label: "Permanent", seconds: undefined },
];

export function BanUserDialog({
	open,
	onOpenChange,
	user,
	onBanUser,
}: BanUserDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<BanUserFormData>({
		resolver: zodResolver(banUserSchema),
		defaultValues: {
			banReason: "",
			banDuration: "1d" as const,
		},
	});

	const handleSubmit = async (data: BanUserFormData) => {
		if (!user) return;

		if (user.role === "admin") {
			toast.error("You cannot ban an admin user.");
			return;
		}

		setIsSubmitting(true);
		try {
			const duration = durationOptions.find(
				(d) => d.value === data.banDuration,
			);
			const banExpiresIn = duration?.seconds;

			await onBanUser(user.id, data.banReason, banExpiresIn);

			toast.success(`${user.name} has been banned successfully`);
			onOpenChange(false);
			form.reset();
		} catch (error) {
			toast.error("Failed to ban user. Please try again.");
			console.error("Error banning user:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancel = () => {
		form.reset();
		onOpenChange(false);
	};

	if (!user) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Ban className="h-5 w-5 text-destructive" />
						Ban User
					</DialogTitle>
					<DialogDescription>
						You are about to ban <strong>{user.name}</strong> ({user.email}).
						This action will prevent them from accessing the platform.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="banReason"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Ban Reason</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter the reason for banning this user..."
											className="resize-none"
											rows={3}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Provide a reason for the ban (optional, max 500 characters)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="banDuration"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Ban Duration *</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select ban duration" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{durationOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										How long should this ban last?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className="gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Banning...
									</>
								) : (
									<>
										<Ban className="mr-2 h-4 w-4" />
										Ban User
									</>
								)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
