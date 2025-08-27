"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useFilesContext } from "@/contexts/FilesContext";
import { parseFileMetadata } from "@/lib/metadata";
import { formatFileSize } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { prefixWithCdn } from "./lib/utils";

export function FilePreviewDialog() {
	const trpc = useTRPC();
	const { data: settings } = useSuspenseQuery(
		trpc.settings.public.queryOptions(),
	);
	const { previewFile, setPreviewFile, downloadFile } = useFilesContext();

	// Hooks must be declared unconditionally and in the same order on every render.
	const [isCopying, setIsCopying] = useState(false);

	const handleCopy = useCallback(async () => {
		if (!previewFile) {
			toast.error("No file URL available to copy");
			return;
		}

		const originalFileUrl = prefixWithCdn(
			`/api/f/${previewFile.key}.${previewFile.originalName.split(".").pop()}`,
			settings?.cdnUrl,
		);

		if (!originalFileUrl) {
			toast.error("No file URL available to copy");
			return;
		}

		try {
			setIsCopying(true);
			await navigator.clipboard.writeText(originalFileUrl);
			toast.success("Link copied to clipboard");
		} catch (err) {
			console.error("Failed to copy link:", err);
			toast.error("Failed to copy link");
		} finally {
			setIsCopying(false);
		}
	}, [previewFile, settings]);

	const isOpen = !!previewFile;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setPreviewFile(null);
		}
	};

	if (!previewFile) return null;

	const metadata = parseFileMetadata(previewFile.metadata);

	const previewUrl = metadata?.preview
		? prefixWithCdn(`/api/f/${metadata.preview}`, settings?.cdnUrl)
		: null;
	const thumbnailUrl = metadata?.thumbnail
		? prefixWithCdn(`/api/f/${metadata.thumbnail}`, settings?.cdnUrl)
		: null;
	const originalFileUrl = prefixWithCdn(
		`/api/f/${previewFile.key}.${previewFile.originalName.split(".").pop()}`,
		settings?.cdnUrl,
	);

	const isImage = previewFile.mimeType.startsWith("image/");
	const isVideo = previewFile.mimeType.startsWith("video/");
	const isAudio = previewFile.mimeType.startsWith("audio/");

	const getPreviewContent = () => {
		// For images, show the original file directly
		if (isImage) {
			return (
				<img
					src={originalFileUrl}
					alt={previewFile.originalName}
					className="max-h-[60vh] max-w-full rounded object-contain"
				/>
			);
		}

		// For videos, show preview if available, otherwise thumbnail
		if (isVideo) {
			if (previewUrl) {
				return (
					// biome-ignore lint/a11y/useMediaCaption: <idc>
					<video
						src={previewUrl}
						controls
						className="max-h-[60vh] max-w-full rounded"
						preload="metadata"
					>
						Your browser does not support the video tag.
					</video>
				);
			}
			if (thumbnailUrl) {
				return (
					<div className="flex flex-col items-center gap-4">
						<img
							src={thumbnailUrl}
							alt={previewFile.originalName}
							className="max-h-[40vh] max-w-full rounded object-contain"
						/>
						<p className="text-muted-foreground text-sm">
							Video preview not available. Download to view full video.
						</p>
					</div>
				);
			}
		}

		// For audio, show thumbnail if available
		if (isAudio && thumbnailUrl) {
			return (
				<div className="flex flex-col items-center gap-4">
					<img
						src={thumbnailUrl}
						alt={previewFile.originalName}
						className="max-h-[40vh] max-w-full rounded object-contain"
					/>
					<p className="text-muted-foreground text-sm">
						Audio file. Download to play.
					</p>
				</div>
			);
		}

		// Fallback for unsupported files
		return (
			<div className="flex flex-col items-center gap-4 py-8">
				<div className="text-6xl text-muted-foreground">📄</div>
				<div className="text-center">
					<p className="font-medium text-lg">{previewFile.originalName}</p>
					<p className="text-muted-foreground text-sm">
						Preview not available for this file type.
					</p>
					<p className="text-muted-foreground text-sm">
						Download to view the file.
					</p>
				</div>
			</div>
		);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[80vh] w-fit overflow-auto">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<div className="min-w-0 flex-1">
							<DialogTitle className="max-w-4/6 truncate pr-2">
								{previewFile.originalName}
							</DialogTitle>
							<DialogDescription>
								{formatFileSize(previewFile.size)} • {previewFile.mimeType}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="flex min-h-[200px] items-center justify-center">
					{getPreviewContent()}
				</div>

				<div className="mt-4 flex justify-center gap-2">
					<Button
						size="lg"
						onClick={() => downloadFile(previewFile)}
						className="gap-2"
					>
						<Download size={16} />
						Download
					</Button>

					<Button size="lg" onClick={handleCopy} className="gap-2">
						<Copy size={16} />
						{isCopying ? "Copying..." : "Copy Link"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
