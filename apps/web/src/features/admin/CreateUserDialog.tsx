"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
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
import { authClient } from "@/lib/auth";
import { useTRPC } from "@/trpc/client";

const createUserSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Invalid email"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	role: z.enum(["user", "admin"]),
	quotaMb: z.coerce.number().min(0, "Quota must be >= 0"),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

export default function CreateUserDialog() {
	const [open, setOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const form = useForm<CreateUserValues>({
		resolver: zodResolver(
			createUserSchema,
		) as unknown as Resolver<CreateUserValues>,
		defaultValues: {
			name: "",
			email: "",
			password: "",
			role: "user",
			quotaMb: 0,
		},
	});

	const resetForm = () => form.reset();

	const onSubmit = async ({ quotaMb, ...rest }: CreateUserValues) => {
		setIsSubmitting(true);
		try {
			const quotaBytes = Math.round((quotaMb ?? 0) * 1024 * 1024);
			await authClient.admin.createUser({
				...rest,
				data: {
					quota: quotaBytes,
				},
			});
			toast.success("User created");
			setOpen(false);
			resetForm();
		} catch (err) {
			console.error(err);
			toast.error("Failed to create user");
		} finally {
			setIsSubmitting(false);
			queryClient.invalidateQueries({
				queryKey: trpc.admin.getUsers.queryKey(),
				exact: false,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button className="self-end">Add User</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Create User</DialogTitle>
					<DialogDescription>Create a new user account.</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
						noValidate
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Full name</FormLabel>
									<FormControl>
										<Input placeholder="Jane Doe" {...field} />
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
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input
											placeholder="jane@example.com"
											type="email"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<Input
											placeholder="Enter a password"
											type="password"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Role</FormLabel>
									<FormControl>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="user">User</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="quotaMb"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Quota (MB)</FormLabel>
									<FormControl>
										<Input
											type="number"
											step="1"
											min={0}
											value={String(field.value ?? 0)}
											onChange={(e) => field.onChange(Number(e.target.value))}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type="submit" disabled={isSubmitting} className="mr-2">
								{isSubmitting ? "Creating..." : "Create"}
							</Button>
							<Button
								variant="ghost"
								onClick={() => {
									setOpen(false);
								}}
							>
								Cancel
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
