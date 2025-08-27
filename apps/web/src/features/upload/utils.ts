import type { FileChunk, UploadResponse, UploadStatus } from "./types";

export function createFileChunks(file: File, chunkSize: number): FileChunk[] {
  const chunks: FileChunk[] = [];
  let offset = 0;
  let index = 0;

  while (offset < file.size) {
    const size = Math.min(chunkSize, file.size - offset);
    const chunk = file.slice(offset, offset + size);

    chunks.push({
      chunk,
      offset,
      size,
      index,
    });

    offset += size;
    index++;
  }

  return chunks;
}

export class ChunkedUploader {
  private baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  async initUpload(filename: string, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/upload/init`);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.id);
          } catch (error) {
            reject(new Error(`Failed to parse server response: ${error}`));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const errorMessage =
              errorResponse.message ||
              errorResponse.error ||
              `HTTP ${xhr.status}: ${xhr.statusText}`;
            reject(new Error(errorMessage));
          } catch (_parseError) {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () =>
        reject(
          new Error(
            "Network error. Please check your connection and try again.",
          ),
        );
      xhr.ontimeout = () =>
        reject(
          new Error(
            "Request timed out. Please check your connection and try again.",
          ),
        );

      xhr.timeout = 10000; // 10 second timeout
      xhr.send(JSON.stringify({ filename, size }));
    });
  }

  async uploadChunk(
    id: string,
    chunk: Blob,
    offset: number,
    onProgress?: (loaded: number, total: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/upload/chunk/${id}`);
      xhr.setRequestHeader("x-offset", offset.toString());

      // Handle abort signal
      const abortHandler = () => {
        xhr.abort();
        reject(new Error("Upload aborted"));
      };

      if (abortSignal) {
        if (abortSignal.aborted) {
          reject(new Error("Upload aborted"));
          return;
        }
        abortSignal.addEventListener("abort", abortHandler);
      }

      // Progress tracking
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const errorMessage =
              errorResponse.message ||
              errorResponse.error ||
              `HTTP ${xhr.status}: ${xhr.statusText}`;
            reject(new Error(errorMessage));
          } catch (_parseError) {
            reject(
              new Error(
                `HTTP ${xhr.status}: Failed to upload chunk - ${xhr.statusText}`,
              ),
            );
          }
        }
      };

      xhr.onerror = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        reject(
          new Error(
            "Network error during chunk upload. Please check your connection.",
          ),
        );
      };

      xhr.ontimeout = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        reject(new Error("Chunk upload timed out. Please try again."));
      };

      xhr.onabort = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
        reject(new Error("Upload was cancelled"));
      };

      // Set timeout (30 seconds for chunk uploads)
      xhr.timeout = 30000;

      xhr.send(chunk);
    });
  }

  async finishUpload(id: string): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/upload/finish/${id}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse server response: ${error}`));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const errorMessage =
              errorResponse.message ||
              errorResponse.error ||
              `HTTP ${xhr.status}: ${xhr.statusText}`;
            reject(new Error(errorMessage));
          } catch (_parseError) {
            reject(
              new Error(
                `HTTP ${xhr.status}: Failed to finish upload - ${xhr.statusText}`,
              ),
            );
          }
        }
      };

      xhr.onerror = () =>
        reject(new Error("Network error during upload finish"));
      xhr.ontimeout = () => reject(new Error("Upload finish timeout"));

      xhr.timeout = 10000; // 10 second timeout
      xhr.send();
    });
  }

  async getUploadStatus(id: string): Promise<UploadStatus> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${this.baseUrl}/upload/status/${id}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        } else {
          reject(
            new Error(
              `Failed to get upload status: HTTP ${xhr.status} ${xhr.statusText}`,
            ),
          );
        }
      };

      xhr.onerror = () =>
        reject(new Error("Network error during status check"));
      xhr.ontimeout = () => reject(new Error("Status check timeout"));

      xhr.timeout = 5000; // 5 second timeout
      xhr.send();
    });
  }

  async cancelUpload(id: string): Promise<{ status: string; message: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("DELETE", `${this.baseUrl}/upload/cancel/${id}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        } else {
          reject(
            new Error(
              `Failed to cancel upload: HTTP ${xhr.status} ${xhr.statusText}`,
            ),
          );
        }
      };

      xhr.onerror = () =>
        reject(new Error("Network error during upload cancellation"));
      xhr.ontimeout = () => reject(new Error("Upload cancellation timeout"));

      xhr.timeout = 5000; // 5 second timeout
      xhr.send();
    });
  }

  getDownloadUrl(id: string): string {
    return `${this.baseUrl}/download/${id}`;
  }
}
