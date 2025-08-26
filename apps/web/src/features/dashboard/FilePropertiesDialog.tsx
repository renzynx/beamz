"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { parseFileMetadata } from "@/lib/metadata";
import { formatDate, formatFileSize, getFileType } from "@/lib/utils";
import { useFilesContext } from "../../contexts/FilesContext";

export function FilePropertiesDialog() {
	const { propertiesFile, setPropertiesFile } = useFilesContext();

	const metadata = useMemo(
		() =>
			propertiesFile?.metadata
				? parseFileMetadata(propertiesFile.metadata)
				: null,
		[propertiesFile?.metadata],
	);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setPropertiesFile(null);
		}
	};

	if (!propertiesFile) return null;

	return (
		<Dialog open={!!propertiesFile} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>File Properties</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Basic Information */}
					<div className="space-y-3">
						<div>
							<label className="font-medium text-muted-foreground text-sm">
								Name
							</label>
							<p className="break-all text-sm">{propertiesFile.originalName}</p>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="font-medium text-muted-foreground text-sm">
									Size
								</label>
								<p className="text-sm">{formatFileSize(propertiesFile.size)}</p>
							</div>
							<div>
								<label className="font-medium text-muted-foreground text-sm">
									Type
								</label>
								<div>
									<Badge variant="secondary" className="text-xs">
										{getFileType(propertiesFile.mimeType)}
									</Badge>
								</div>
							</div>
						</div>

						<div>
							<label className="font-medium text-muted-foreground text-sm">
								MIME Type
							</label>
							<p className="font-mono text-muted-foreground text-sm">
								{propertiesFile.mimeType}
							</p>
						</div>
					</div>

					<Separator />

					{/* Dates */}
					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="font-medium text-muted-foreground text-sm">
									Uploaded
								</label>
								<p className="text-sm">
									{formatDate(propertiesFile.createdAt)}
								</p>
							</div>
							<div>
								<label className="font-medium text-muted-foreground text-sm">
									Modified
								</label>
								<p className="text-sm">
									{formatDate(propertiesFile.updatedAt)}
								</p>
							</div>
						</div>
					</div>

					{/* Media-specific metadata */}
					{metadata && (
						<>
							<Separator />
							<div className="space-y-3">
								<h4 className="font-medium text-sm">Media Information</h4>

								{/* Thumbnail info */}
								{metadata.thumbnail && (
									<div>
										<label className="font-medium text-muted-foreground text-xs">
											Thumbnail
										</label>
										<div className="mt-1 flex gap-1">
											<Badge variant="outline" className="text-xs">
												{metadata.type === "album_cover"
													? "Album Cover"
													: metadata.type === "waveform"
														? "Waveform"
														: "Generated"}
											</Badge>
										</div>
									</div>
								)}

								{/* Preview info */}
								{metadata.preview && (
									<div>
										<label className="font-medium text-muted-foreground text-xs">
											Preview
										</label>
										<div className="mt-1 flex gap-1">
											<Badge variant="outline" className="text-xs">
												Generated
											</Badge>
										</div>
									</div>
								)}
							</div>
						</>
					)}

					<Separator />

					{/* Technical Details */}
					<div className="space-y-3">
						<h4 className="font-medium text-sm">Technical Details</h4>
						<div>
							<label className="font-medium text-muted-foreground text-xs">
								File Key
							</label>
							<p className="break-all font-mono text-muted-foreground text-xs">
								{propertiesFile.key}
							</p>
						</div>
						<div>
							<label className="font-medium text-muted-foreground text-xs">
								File ID
							</label>
							<p className="break-all font-mono text-muted-foreground text-xs">
								{propertiesFile.id}
							</p>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
