import type { AppType } from "@beam/shared";
import { hc } from "hono/client";

const CRON_BASE = `http://localhost:${process.env.CRON_CONTROL_PORT ?? 3335}`;

// Hono RPC client
const client = hc<AppType>(CRON_BASE);

async function handleResponse<T = any>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;

  const parsed = (await res
    .json()
    .catch(() => ({ error: "Unknown error" }))) as {
    error?: string;
  };

  throw new Error(parsed.error || `HTTP ${res.status}: ${res.statusText}`);
}

export async function enqueueThumbnail(
  fileId: string,
  actualFilename: string,
  mimeType: string,
) {
  try {
    const res = await client.enqueue.thumbnail.$post({
      json: {
        fileId,
        actualFilename,
        mimeType,
      },
    });

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to enqueue thumbnail: ${err?.message || err}`);
    throw err;
  }
}

export async function enqueueDiskCleanup(
  filePaths: string[],
  description?: string,
) {
  try {
    const res = await client.enqueue["disk-cleanup"].$post({
      json: {
        filePaths,
        description,
      },
    });

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to enqueue disk cleanup: ${err?.message || err}`);
    throw err;
  }
}

export async function cronHealth() {
  try {
    const res = await client.health.$get();

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to get cron health: ${err?.message || err}`);
    throw err;
  }
}

export async function cronRestart() {
  try {
    const res = await client.restart.$post();

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to restart cron: ${err?.message || err}`);
    throw err;
  }
}

export async function cronReloadSettings() {
  try {
    const res = await client["reload-settings"].$post();

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to reload cron settings: ${err?.message || err}`);
    throw err;
  }
}

export async function cronStart() {
  try {
    const res = await client.start.$post();

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to start cron: ${err?.message || err}`);
    throw err;
  }
}

export async function cronStop() {
  try {
    const res = await client.stop.$post();

    return await handleResponse(res);
  } catch (err: any) {
    console.error(`Failed to stop cron: ${err?.message || err}`);
    throw err;
  }
}
