"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, UserRoundPen } from "lucide-react";
import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const editUserSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less"),
	email: z.email("Invalid email address"),
	quota: z.number().min(0, "Quota must be 0 or greater").optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: {
		id: string;
		name: string;
		email: string;
		role?: string | null;
		quota: number;
	} | null;
	onEditUser: (
		userId: string,
		data: {
			name: string;
			email: string;
			role?: string;
			quota?: number;
		},
	) => Promise<void>;
}

const roleOptions = [
	{ value: "user", label: "User" },
	{ value: "admin", label: "Admin" },
];

const quotaOptions = [
	{ value: 0, label: "Unlimited" },
	{ value: 1024 * 1024 * 100, label: "100 MB" },
	{ value: 1024 * 1024 * 500, label: "500 MB" },
	{ value: 1024 * 1024 * 1024, label: "1 GB" },
	{ value: 1024 * 1024 * 1024 * 5, label: "5 GB" },
	{ value: 1024 * 1024 * 1024 * 10, label: "10 GB" },
];

export function EditUserDialog({
	open,
	onOpenChange,
	user,
	onEditUser,
}: EditUserDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<EditUserFormData>({
		resolver: zodResolver(editUserSchema),
		defaultValues: {
			name: user?.name || "",
			email: user?.email || "",
			quota: user?.quota || 0,
		},
	});

	// Update form when user changes
	React.useEffect(() => {
		if (user) {
			form.reset({
				name: user.name,
				email: user.email,
				quota: user.quota,
			});
		}
	}, [user, form]);

	const handleSubmit = async (data: EditUserFormData) => {
		if (!user) return;

		setIsSubmitting(true);
		try {
			await onEditUser(user.id, {
				name: data.name,
				email: data.email,
				quota: data.quota,
			});

			toast.success(`${user.name} has been updated successfully`);
			onOpenChange(false);
		} catch (error) {
			toast.error("Failed to update user. Please try again.");
			console.error("Error updating user:", error);
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
						<UserRoundPen className="h-5 w-5" />
						Edit User
					</DialogTitle>
					<DialogDescription>
						Update user information for <strong>{user.name}</strong> (
						{user.email}).
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name *</FormLabel>
									<FormControl>
										<Input placeholder="Enter user's name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email *</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="Enter user's email"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="quota"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Storage Quota</FormLabel>
									<Select
										onValueChange={(value) => field.onChange(Number(value))}
										defaultValue={field.value?.toString()}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select storage quota" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{quotaOptions.map((option) => (
												<SelectItem
													key={option.value}
													value={option.value.toString()}
												>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										Maximum storage space for this user
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
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Updating...
									</>
								) : (
									<>
										<Save className="mr-2 h-4 w-4" />
										Update User
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
