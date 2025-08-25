"use client";

import { useId, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
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
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputList,
} from "@/components/ui/tags-input";
import { toast } from "sonner";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const generalSettingsSchema = z
  .object({
    appName: z.string().min(1, { error: "App name is required" }),
    cdnUrl: z.preprocess(
      (v) => {
        if (typeof v === "string" && v.trim() === "") return undefined;
        return v;
      },
      z.string().url({ error: "Invalid URL" }).optional().nullable()
    ),
    enableSignUp: z.boolean(),
    chunkSizeMB: z.preprocess(
      (v) => Number(v),
      z.number().int().min(1).max(100)
    ),
    maxFileSizeMB: z.preprocess(
      (v) => Number(v),
      z.number().int().min(1).max(10240)
    ),
    blackListedExtensions: z
      .array(
        z.string().refine((ext) => ext.startsWith(".") && ext.length > 1, {
          error: "Extensions must start with a dot (e.g., .exe, .sh, .msi)",
        })
      )
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.maxFileSizeMB < val.chunkSizeMB) {
      ctx.addIssue({
        path: ["maxFileSizeMB"],
        code: z.ZodIssueCode.custom,
        message: "Max file size must be greater than or equal to chunk size",
      });
    }
  });

export function GeneralSettings() {
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: currentRaw } = useSuspenseQuery(
    trpc.settings.get.queryOptions()
  );

  // Initialize react-hook-form with default values from current settings
  const form = useForm<any>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      appName: currentRaw?.appName ?? "",
      cdnUrl: currentRaw?.cdnUrl ?? null,
      enableSignUp: !!currentRaw?.enableSignUp,
      chunkSizeMB:
        typeof currentRaw?.chunkSize === "number"
          ? String(Math.round(currentRaw.chunkSize / (1024 * 1024)))
          : "",
      maxFileSizeMB:
        typeof currentRaw?.maxFileSize === "number"
          ? String(Math.round(currentRaw.maxFileSize / (1024 * 1024)))
          : "",
      blackListedExtensions: (currentRaw?.blackListedExtensions as any[]) ?? [],
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = form;

  const mutation = useMutation(trpc.settings.set.mutationOptions());

  // Reset form when currentRaw updates
  useEffect(() => {
    if (!currentRaw) return;
    reset({
      appName: currentRaw.appName ?? "",
      // ensure cdnUrl is null when not set so empty values are saved as null
      cdnUrl: currentRaw.cdnUrl ?? null,
      enableSignUp: !!currentRaw.enableSignUp,
      chunkSizeMB:
        typeof currentRaw?.chunkSize === "number"
          ? String(Math.round(currentRaw.chunkSize / (1024 * 1024)))
          : "",
      maxFileSizeMB:
        typeof currentRaw.maxFileSize === "number"
          ? String(Math.round(currentRaw.maxFileSize / (1024 * 1024)))
          : "",
      blackListedExtensions: (currentRaw.blackListedExtensions as any[]) ?? [],
    });
  }, [currentRaw, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const { chunkSizeMB: chunkMB, maxFileSizeMB: maxMB } = values as any;

    // Convert MB -> bytes for backend
    const chunkBytes = Math.round(chunkMB * 1024 * 1024);
    const maxBytes = Math.round(maxMB * 1024 * 1024);

    try {
      // Remove any trailing slash(es) from CDN URL before sending
      const normalizedCdn =
        values.cdnUrl && values.cdnUrl.trim() !== ""
          ? values.cdnUrl.replace(/\/+$/, "")
          : null;

      await mutation.mutateAsync({
        appName: values.appName,
        cdnUrl: normalizedCdn,
        enableSignUp: values.enableSignUp,
        chunkSize: chunkBytes,
        maxFileSize: maxBytes,
        blackListedExtensions: values.blackListedExtensions ?? [],
      });

      queryClient.setQueryData(trpc.settings.public.queryKey(), (old) => {
        if (!old) return old;
        return {
          ...old,
          cdnUrl: normalizedCdn,
        };
      });

      toast.success("General settings saved successfully");
    } catch (err: any) {
      console.error("Failed to save general settings", err);
      toast.error(err?.message || "Failed to save general settings");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Configure general application settings and file upload limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <FormField
                  control={control}
                  name="appName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor={`${id}-appName`}>App name</FormLabel>
                      <FormControl>
                        <Input
                          id={`${id}-appName`}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="My app"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {formErrors.appName?.message && (
                  <div className="text-sm text-destructive mt-1">
                    {String(formErrors.appName.message)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id}-chunk`}>Chunk size (MB)</Label>
                <FormField
                  control={control}
                  name="chunkSizeMB"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id={`${id}-chunk`}
                          type="number"
                          min={1}
                          max={100}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value.replace(/[^0-9]/g, "")
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="5"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {formErrors.chunkSizeMB?.message && (
                  <div className="text-sm text-destructive mt-1">
                    {String(formErrors.chunkSizeMB.message)}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id}-max`}>Max file size (MB)</Label>
                <FormField
                  control={control}
                  name="maxFileSizeMB"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id={`${id}-max`}
                          type="number"
                          min={1}
                          max={10240}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value.replace(/[^0-9]/g, "")
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="512"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {formErrors.maxFileSizeMB?.message && (
                  <div className="text-sm text-destructive mt-1">
                    {String(formErrors.maxFileSizeMB.message)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-blacklisted`}>
                  Blacklisted Extensions
                </Label>
                <FormField
                  control={control}
                  name="blackListedExtensions"
                  render={({ field }) => {
                    const list = field.value ?? [];
                    return (
                      <FormItem>
                        <FormControl>
                          <TagsInput
                            value={list}
                            onValueChange={(v) => field.onChange(v)}
                            className="w-full"
                          >
                            <TagsInputList>
                              {list.map((extension: string) => (
                                <TagsInputItem
                                  key={extension}
                                  value={extension}
                                >
                                  {extension}
                                </TagsInputItem>
                              ))}
                              <TagsInputInput
                                id={`${id}-blacklisted`}
                                placeholder="Add extension (e.g., .exe, .sh, .msi)..."
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" ||
                                    e.key === " " ||
                                    e.key === ","
                                  ) {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    let value = input.value.trim();

                                    if (value && !value.startsWith(".")) {
                                      value = "." + value;
                                    }

                                    if (
                                      value &&
                                      value.length > 1 &&
                                      !list.includes(value)
                                    ) {
                                      field.onChange([...list, value]);
                                      input.value = "";
                                    }
                                  }
                                }}
                              />
                            </TagsInputList>
                          </TagsInput>
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />

                {formErrors.blackListedExtensions?.message && (
                  <div className="text-sm text-destructive mt-1">
                    {String(formErrors.blackListedExtensions.message)}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  File extensions that are not allowed to be uploaded.
                  Extensions must start with a dot (e.g., .exe, .sh, .msi).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${id}-cdn`}>CDN URL</Label>
                <FormField
                  control={control}
                  name="cdnUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id={`${id}-cdn`}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="https://cdn.example.com"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {formErrors.cdnUrl?.message && (
                  <div className="text-sm text-destructive mt-1">
                    {String(formErrors.cdnUrl.message)}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Optional CDN origin for serving uploaded files.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 py-4 border-t border-b">
              <FormField
                control={control}
                name="enableSignUp"
                render={({ field }) => (
                  <>
                    <Switch
                      id={`${id}-signup`}
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(!!v)}
                    />
                    <Label htmlFor={`${id}-signup`}>Enable sign up</Label>
                  </>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save General Settings"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
