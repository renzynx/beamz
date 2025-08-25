import type { CronStatus } from "../../../background-jobs/src/lib/types";

const CRON_BASE = process.env.CRON_BASE_URL || "http://localhost:3335";

export interface EnqueueThumbnailPayload {
  fileId: string;
  actualFilename: string;
  mimeType: string;
  originalName?: string;
}

export interface EnqueueThumbnailResponse {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

export interface EnqueueDiskCleanupPayload {
  filePaths: string[];
  description?: string;
}

export interface EnqueueDiskCleanupResponse {
  success: boolean;
  message?: string;
  count?: number;
  error?: string;
}

export interface ControlResponse {
  success: boolean;
  message?: string;
  error?: string;
}

async function enqueueJob<TPayload, TResponse>(
  endpoint: string,
  body: TPayload
): Promise<TResponse> {
  const res = await fetch(`${CRON_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }

  return (await res.json()) as TResponse;
}

export async function enqueueThumbnail(
  fileId: string,
  actualFilename: string,
  mimeType: string,
  originalName?: string
): Promise<EnqueueThumbnailResponse> {
  const payload: EnqueueThumbnailPayload = {
    fileId,
    actualFilename,
    mimeType,
    originalName,
  };
  try {
    return await enqueueJob<EnqueueThumbnailPayload, EnqueueThumbnailResponse>(
      "enqueue/thumbnail",
      payload
    );
  } catch (err: any) {
    console.error(`Failed to enqueue thumbnail: ${err?.message || err}`);
    throw err;
  }
}

export async function enqueueDiskCleanup(
  filePaths: string[],
  description?: string
): Promise<EnqueueDiskCleanupResponse> {
  const payload: EnqueueDiskCleanupPayload = { filePaths, description };
  try {
    return await enqueueJob<
      EnqueueDiskCleanupPayload,
      EnqueueDiskCleanupResponse
    >("enqueue/disk-cleanup", payload);
  } catch (err: any) {
    console.error(`Failed to enqueue disk cleanup: ${err?.message || err}`);
    throw err;
  }
}

async function callControl<T = ControlResponse>(
  path: string,
  method: string = "POST"
): Promise<T> {
  const res = await fetch(`${CRON_BASE}/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }

  return (await res.json()) as T;
}

export async function cronHealth(): Promise<{
  status: string;
  timestamp: string;
  cron: CronStatus;
}> {
  return (await callControl<typeof fetch>("health", "GET")) as unknown as {
    status: string;
    timestamp: string;
    cron: CronStatus;
  };
}

export async function cronRestart(): Promise<ControlResponse> {
  return await callControl<ControlResponse>("restart", "POST");
}

export async function cronReloadSettings(): Promise<ControlResponse> {
  return await callControl<ControlResponse>("reload-settings", "POST");
}

export async function cronStart(): Promise<ControlResponse> {
  return await callControl<ControlResponse>("start", "POST");
}

export async function cronStop(): Promise<ControlResponse> {
  return await callControl<ControlResponse>("stop", "POST");
}
