export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface JobInfo {
  running: boolean;
  schedule: string;
  lastRun?: Date;
}

export interface CronSettings {
  jobCleanupSchedule: string;
  tempCleanupSchedule: string;
  logLevel: string;
  timezone: string;
}

export interface CronStatus {
  cleanupJob: JobInfo;
  tempCleanupJob: JobInfo;
  settingsWatcher: { running: boolean; interval: string };
}

export type LogLevel = "info" | "error" | "warn" | "debug";

export interface FileMetadata {
  thumbnail: string | null;
  preview: string | null;
  type?: string;
}

export interface UploadMetadata {
  chunks: Set<number>;
  size: number;
  finished: boolean;
  filename: string;
  totalChunks: number;
  userId: string;
  chunkSize: number;
}
