"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Download,
	FileText,
	Folder,
	Music,
	Play,
	PlayCircle,
	RefreshCw,
	Settings,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFilesContext } from "@/contexts/FilesContext";
import { prefixWithCdn } from "@/features/dashboard/lib/utils";
import {
	getPreviewUrl,
	getThumbnailUrl,
	hasPreview,
	hasThumbnail,
	parseFileMetadata,
} from "@/lib/metadata";
import { formatFileSize, formatRelativeTime, getFileType } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import type { FileItem } from "@/trpc/types";

interface FileCardProps {
	file: FileItem;
	isSelected: boolean;
	onToggleSelection: (fileId: string) => void;
}

export function FileCard({
	file,
	isSelected,
	onToggleSelection,
}: FileCardProps) {
	const [imageError, setImageError] = useState(false);
	const [isHovering, setIsHovering] = useState(false);
	const [videoError, setVideoError] = useState(false);

	const {
		downloadFile,
		regenerateThumbnail,
		showDeleteConfirmation,
		showProperties,
		showPreview,
		isRegeneratingThumbnail,
	} = useFilesContext();

	const metadata = useMemo(
		() => parseFileMetadata(file.metadata),
		[file.metadata],
	);

	const trpc = useTRPC();
	const { data: settings } = useSuspenseQuery(
		trpc.settings.public.queryOptions(),
	);

	const isVideo = file.mimeType.startsWith("video/");
	const isAudio = file.mimeType.startsWith("audio/");
	const isPdf = file.mimeType.includes("pdf");

	const thumbnailUrl = getThumbnailUrl(metadata);
	const previewUrl = getPreviewUrl(metadata);
	const hasValidThumbnail = hasThumbnail(metadata);
	const hasValidPreview = hasPreview(metadata);

	const thumbnailUrlPrefixed = thumbnailUrl
		? prefixWithCdn(thumbnailUrl, settings?.cdnUrl ?? null)
		: thumbnailUrl;
	const previewUrlPrefixed = previewUrl
		? prefixWithCdn(previewUrl, settings?.cdnUrl ?? null)
		: previewUrl;

	const getFileIcon = () => {
		if (isAudio) return <Music className="h-12 w-12 text-muted-foreground" />;
		if (isVideo)
			return <PlayCircle className="h-12 w-12 text-muted-foreground" />;
		if (isPdf) return <FileText className="h-12 w-12 text-muted-foreground" />;
		return <Folder className="h-12 w-12 text-muted-foreground" />;
	};

	const handleDownload = async (e?: React.MouseEvent) => {
		if (e) e.preventDefault();
		try {
			downloadFile(file);
		} catch (error) {
			console.error("Download error:", error);
		}
	};

	const handleProperties = async (e?: React.MouseEvent) => {
		if (e) e.preventDefault();
		try {
			showProperties(file);
		} catch (error) {
			console.error("Properties error:", error);
		}
	};

	const handleRegenerateThumbnail = async (e?: React.MouseEvent) => {
		if (e) e.preventDefault();
		try {
			await regenerateThumbnail(file);
		} catch (error) {
			console.error("Regenerate thumbnail error:", error);
		}
	};

	const handleDelete = async (e?: React.MouseEvent) => {
		if (e) e.preventDefault();
		try {
			showDeleteConfirmation(file);
		} catch (error) {
			console.error("Delete error:", error);
		}
	};

	const handlePreview = async (e?: React.MouseEvent) => {
		if (e) e.preventDefault();
		try {
			showPreview(file);
		} catch (error) {
			console.error("Preview error:", error);
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={`group cursor-pointer overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-lg ${
						isSelected ? "bg-primary/5 ring-2 ring-primary" : ""
					}`}
					onClick={() => onToggleSelection(file.id)}
					onMouseEnter={() => setIsHovering(true)}
					onMouseLeave={() => setIsHovering(false)}
				>
					<div className="relative aspect-video overflow-hidden bg-muted">
						{hasValidThumbnail && thumbnailUrl && !imageError ? (
							<>
								{isVideo &&
								isHovering &&
								hasValidPreview &&
								previewUrlPrefixed &&
								!videoError ? (
									<video
										src={previewUrlPrefixed}
										className="h-full w-full object-cover"
										autoPlay
										muted
										loop
										playsInline
										onError={() => setVideoError(true)}
									/>
								) : (
									<img
										src={thumbnailUrlPrefixed || thumbnailUrl}
										alt={file.originalName}
										className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
										loading="lazy"
										onError={() => {
											setImageError(true);
										}}
									/>
								)}
							</>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
								{getFileIcon()}
							</div>
						)}

						{isVideo && (
							<div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-white text-xs">
								<PlayCircle className="mr-1 inline h-3 w-3" />
								Video
							</div>
						)}

						{isAudio && (
							<div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-white text-xs">
								<Music className="mr-1 inline h-3 w-3" />
								Audio
							</div>
						)}

						<div className="absolute top-2 right-2">
							<Checkbox
								checked={isSelected}
								onCheckedChange={() => onToggleSelection(file.id)}
								aria-label={`Select ${file.originalName}`}
								className="border-white/50 bg-black/20 shadow-lg data-[state=checked]:border-primary data-[state=checked]:bg-primary"
								onClick={(e) => e.stopPropagation()}
							/>
						</div>
					</div>

					<div className="space-y-2 p-3">
						{/* Title */}
						<h3
							className="line-clamp-1 font-medium text-sm leading-tight transition-colors group-hover:text-primary"
							title={file.originalName}
						>
							{file.originalName}
						</h3>

						{/* Metadata row */}
						<div className="flex items-center justify-between text-muted-foreground text-xs">
							<span>{formatFileSize(file.size)}</span>
							<div className="flex items-center gap-1">
								{/* Show thumbnail type for audio files */}
								{isAudio && metadata?.type === "album_cover" && (
									<Badge variant="outline" className="text-xs">
										Album
									</Badge>
								)}
								<Badge variant="secondary" className="text-xs">
									{getFileType(file.mimeType)}
								</Badge>
							</div>
						</div>

						<div className="flex items-center justify-between text-muted-foreground text-xs">
							<span>
								{file.createdAt
									? formatRelativeTime(file.createdAt)
									: "Unknown date"}
							</span>
						</div>
					</div>
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className="w-56">
				<ContextMenuItem onClick={handlePreview}>
					<Play className="mr-2 h-4 w-4" />
					Preview
				</ContextMenuItem>

				<ContextMenuItem onClick={handleDownload}>
					<Download className="mr-2 h-4 w-4" />
					Download
				</ContextMenuItem>

				<ContextMenuItem onClick={handleProperties}>
					<Settings className="mr-2 h-4 w-4" />
					Properties
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuItem
					onClick={handleRegenerateThumbnail}
					disabled={isRegeneratingThumbnail}
				>
					<RefreshCw
						className={`mr-2 h-4 w-4 ${isRegeneratingThumbnail ? "animate-spin" : ""}`}
					/>
					Regenerate Thumbnail
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuItem onClick={handleDelete} variant="destructive">
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
