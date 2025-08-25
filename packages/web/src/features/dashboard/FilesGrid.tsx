"use client";

import type { FileItem } from "@/trpc/types";
import { FileCard } from "./FileCard";
import { useFilesContext } from "../../contexts/FilesContext";

interface FilesGridProps {
  data: FileItem[];
}

export function FilesGrid({ data }: FilesGridProps) {
  const { isFileSelected, toggleFileSelection } = useFilesContext();

  const files: FileItem[] = data || [];

  if (!files) return null;

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            isSelected={isFileSelected(file.id)}
            onToggleSelection={toggleFileSelection}
          />
        ))}
      </div>

      {/* No files message */}
      {files.length === 0 && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">No files found</h3>
            <p className="text-muted-foreground">
              Upload some files to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
