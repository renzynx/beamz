import type { APIResponse } from "./types";
import { Logger } from "./logger";

export class ApiClient {
  private apiBaseUrl: string;
  private logger: Logger;

  constructor(apiBaseUrl: string, logger: Logger) {
    this.apiBaseUrl = apiBaseUrl;
    this.logger = logger;
  }

  async makeCall<T = any>(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ): Promise<APIResponse<T>> {
    try {
      const url = `${this.apiBaseUrl}${endpoint}`;
      this.logger.debug(`Making API call to: ${url}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      const response = await fetch(url, {
        method: options.method || "POST",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `API call failed: ${response.status} - ${data.error || "Unknown error"}`
        );
      }

      this.logger.debug(`API call successful: ${endpoint}`, data);
      return data;
    } catch (error) {
      this.logger.error(`API call failed: ${endpoint}`, {
        error: error instanceof Error ? error.message : error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async cleanupUploads(): Promise<APIResponse> {
    // No cron secret required - communicating via protected API
    return this.makeCall("/admin/cleanup/cron", {});
  }

  async cleanupTempFiles(): Promise<APIResponse> {
    // No cron secret required - communicating via protected API
    return this.makeCall("/admin/cleanup/cron", {});
  }
}
