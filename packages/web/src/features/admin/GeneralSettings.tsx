"use client";

import { useId, useState, useEffect } from "react";
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
import { mapZodErrors } from "./lib/mapZodError";

const generalSettingsSchema = z
  .object({
    appName: z.string().min(1, { message: "App name is required" }),
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
          message: "Extensions must start with a dot (e.g., .exe, .sh, .msi)",
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

  const [appName, setAppName] = useState<string>("");
  const [enableSignUp, setEnableSignUp] = useState<boolean>(false);
  const [chunkSizeMB, setChunkSizeMB] = useState<string>("");
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<string>("");
  const [blackListedExtensions, setBlackListedExtensions] = useState<string[]>(
    []
  );

  const mutation = useMutation(trpc.settings.set.mutationOptions());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentRaw) return;
    setAppName(currentRaw.appName ?? "");
    setEnableSignUp(!!currentRaw.enableSignUp);
    setBlackListedExtensions(currentRaw.blackListedExtensions ?? []);

    // Convert bytes -> MB
    if (typeof currentRaw.chunkSize === "number") {
      setChunkSizeMB(String(Math.round(currentRaw.chunkSize / (1024 * 1024))));
    }
    if (typeof currentRaw.maxFileSize === "number") {
      setMaxFileSizeMB(
        String(Math.round(currentRaw.maxFileSize / (1024 * 1024)))
      );
    }
  }, [currentRaw]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = generalSettingsSchema.safeParse({
      appName,
      enableSignUp,
      chunkSizeMB,
      maxFileSizeMB,
      blackListedExtensions,
    });

    if (!parsed.success) {
      const mapped = mapZodErrors(parsed.error);
      setErrors(mapped);
      toast.error("Please fix validation errors before saving");
      return;
    }

    setErrors({});

    const { chunkSizeMB: chunkMB, maxFileSizeMB: maxMB } = parsed.data;

    // Convert MB -> bytes for backend
    const chunkBytes = Math.round(chunkMB * 1024 * 1024);
    const maxBytes = Math.round(maxMB * 1024 * 1024);

    try {
      await mutation.mutateAsync({
        appName,
        enableSignUp,
        chunkSize: chunkBytes,
        maxFileSize: maxBytes,
        blackListedExtensions,
      });

      queryClient.invalidateQueries({
        queryKey: trpc.settings.public.queryKey(),
      });

      toast.success("General settings saved successfully");
    } catch (err: any) {
      console.error("Failed to save general settings", err);
      toast.error(err?.message || "Failed to save general settings");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Configure general application settings and file upload limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-appName`}>App name</Label>
              <Input
                id={`${id}-appName`}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My app"
              />
              {errors.appName && (
                <div className="text-sm text-destructive mt-1">
                  {errors.appName}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-chunk`}>Chunk size (MB)</Label>
              <Input
                id={`${id}-chunk`}
                type="number"
                min={1}
                max={100}
                value={chunkSizeMB}
                onChange={(e) =>
                  setChunkSizeMB(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="5"
              />
              {errors.chunkSizeMB && (
                <div className="text-sm text-destructive mt-1">
                  {errors.chunkSizeMB}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${id}-max`}>Max file size (MB)</Label>
              <Input
                id={`${id}-max`}
                type="number"
                min={1}
                max={10240}
                value={maxFileSizeMB}
                onChange={(e) =>
                  setMaxFileSizeMB(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="512"
              />
              {errors.maxFileSizeMB && (
                <div className="text-sm text-destructive mt-1">
                  {errors.maxFileSizeMB}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-blacklisted`}>
                Blacklisted Extensions
              </Label>
              <TagsInput
                value={blackListedExtensions}
                onValueChange={setBlackListedExtensions}
                className="w-full"
              >
                <TagsInputList>
                  {blackListedExtensions.map((extension) => (
                    <TagsInputItem key={extension} value={extension}>
                      {extension}
                    </TagsInputItem>
                  ))}
                  <TagsInputInput
                    id={`${id}-blacklisted`}
                    placeholder="Add extension (e.g., .exe, .sh, .msi)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " " || e.key === ",") {
                        e.preventDefault();
                        const input = e.currentTarget;
                        let value = input.value.trim();

                        if (value && !value.startsWith(".")) {
                          value = "." + value;
                        }

                        if (
                          value &&
                          value.length > 1 &&
                          !blackListedExtensions.includes(value)
                        ) {
                          setBlackListedExtensions([
                            ...blackListedExtensions,
                            value,
                          ]);
                          input.value = "";
                        }
                      }
                    }}
                  />
                </TagsInputList>
              </TagsInput>

              {errors.blackListedExtensions && (
                <div className="text-sm text-destructive mt-1">
                  {errors.blackListedExtensions}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                File extensions that are not allowed to be uploaded. Extensions
                must start with a dot (e.g., .exe, .sh, .msi).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-4 border-t border-b">
            <Switch
              id={`${id}-signup`}
              checked={enableSignUp}
              onCheckedChange={(v) => setEnableSignUp(!!v)}
            />
            <Label htmlFor={`${id}-signup`}>Enable sign up</Label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save General Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
