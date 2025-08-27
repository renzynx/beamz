"use client";

import type { FileItem } from "@/trpc/types";
import { useFilesContext } from "@/contexts/FilesContext";
import { FileCard } from "./FileCard";

interface FilesGridProps {
  data: FileItem[];
}

export function FilesGrid({ data }: FilesGridProps) {
  const { isFileSelected, toggleFileSelection } = useFilesContext();

  const files: FileItem[] = data || [];

  if (!files) return null;

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h3 className="mb-2 font-semibold text-lg">No files found</h3>
            <p className="text-muted-foreground">
              Upload some files to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
