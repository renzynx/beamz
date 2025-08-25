const CRON_BASE = process.env.CRON_BASE_URL || "http://localhost:3335";

export async function enqueueJob(endpoint: string, body: any) {
  try {
    await fetch(`${CRON_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Failed to enqueue ${endpoint} to background service`, err);
  }
}

export async function enqueueThumbnail(
  fileId: string,
  actualFilename: string,
  mimeType?: string,
  originalName?: string
) {
  return enqueueJob("enqueue/thumbnail", {
    fileId,
    actualFilename,
    mimeType,
    originalName,
  });
}

export async function enqueueDiskCleanup(
  filePaths: string[],
  description?: string
) {
  return enqueueJob("enqueue/disk-cleanup", {
    filePaths,
    description,
  });
}

// Control endpoints for the cron/background-jobs control server
async function callControl(path: string, method: string = "POST") {
  try {
    const res = await fetch(`${CRON_BASE}/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`Cron control call failed: ${path}`, error);
    throw error;
  }
}

export async function cronHealth() {
  return callControl("health", "GET");
}

export async function cronRestart() {
  return callControl("restart", "POST");
}

export async function cronReloadSettings() {
  return callControl("reload-settings", "POST");
}

export async function cronStart() {
  return callControl("start", "POST");
}

export async function cronStop() {
  return callControl("stop", "POST");
}
