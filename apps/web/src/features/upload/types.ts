export interface FileChunk {
	chunk: Blob;
	offset: number;
	size: number;
	index: number;
}

export interface UploadProgress {
	uploadedBytes: number;
	totalBytes: number;
	percentage: number;
	chunksUploaded: number;
	totalChunks: number;
}

export interface UploadResponse {
	id: string;
	duplicateOf?: string;
	status: string;
}

export interface UploadStatus {
	id: string;
	filename: string;
	size: number;
	chunkSize: number;
	totalChunks: number;
	receivedChunks: number;
	missingChunks: number[];
	isComplete: boolean;
	finished: boolean;
	progress: number;
	canResume: boolean;
}

export interface UploadFile {
	id: string;
	file: File;
	progress: UploadProgress;
	status:
		| "pending"
		| "uploading"
		| "completed"
		| "error"
		| "cancelled"
		| "paused";
	error?: string;
	uploadResponse?: UploadResponse;
	uploadId?: string;
}

export interface UseChunkedUploadOptions {
	chunkSize: number;
	maxConcurrentUploads?: number;
	onUploadComplete?: (file: UploadFile) => void;
	onUploadError?: (file: UploadFile, error: string) => void;
	onProgress?: (file: UploadFile) => void;
}
