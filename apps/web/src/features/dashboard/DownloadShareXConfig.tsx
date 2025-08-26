"use client";

import Image from "next/image";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";

const CONFIG = (baseUrl: string, apiKey: string) => `{
  "Version": "18.0.1",
  "Name": "Beamz",
  "DestinationType": "ImageUploader, FileUploader",
  "RequestMethod": "POST",
  "RequestURL": "${baseUrl}/api/upload",
  "Headers": {
    "x-api-key": "${apiKey}"
  },
  "Body": "MultipartFormData",
  "FileFormName": "file",
  "URL": "{json:fileUrl}",
  "ThumbnailURL": "{json:thumbnailUrl}"
}`;

export const DownloadShareXConfig = ({
	baseUrl,
	apiKey,
}: {
	baseUrl: string;
	apiKey: string;
}) => {
	const downloadConfig = useCallback(() => {
		const blob = new Blob([CONFIG(baseUrl, apiKey)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "beamz.sxcu";
		a.click();
		URL.revokeObjectURL(url);
	}, [baseUrl, apiKey]);

	return (
		<Button size="lg" className="cursor-pointer" onClick={downloadConfig}>
			<Image
				src="/assets/ShareX_Logo.svg"
				alt="ShareX Logo"
				width={24}
				height={24}
			/>
			Download ShareX Configuration
		</Button>
	);
};
