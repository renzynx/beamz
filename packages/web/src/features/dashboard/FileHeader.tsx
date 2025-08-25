import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ButtonWithTooltip } from "@/components/ButtonWithTooltip";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  List,
  RefreshCcw,
  RotateCcw,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { setView } from "./actions/view";
import { useFilesContext } from "@/contexts/FilesContext";

export const FileHeader = ({
  view,
  refetch,
}: {
  view: string;
  refetch: any;
}) => {
  const {
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    deselectAllFiles,
    updateQueryParams,
  } = useFilesContext();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Files refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh files");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearFilters = () => {
    setSortBy("createdAt");
    setSortDir("desc");
    deselectAllFiles();
    updateQueryParams({
      sortBy: null,
      sortDir: null,
    });
    toast.info("Filters cleared");
  };

  return (
    <div className="flex items-center gap-4 justify-between">
      <div className="text-lg font-medium">Browse Files</div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild>
          <Link href="/dashboard/upload">
            <Upload size={16} />
            Upload
          </Link>
        </Button>

        {/* View Toggle */}
        <div className="flex">
          <ButtonWithTooltip
            size="icon"
            variant={view === "table" ? "default" : "outline"}
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            aria-label="Table view"
            className="rounded-r-none"
            tooltip="Table view"
          >
            <List size={16} />
          </ButtonWithTooltip>

          <ButtonWithTooltip
            size="icon"
            variant={view === "grid" ? "default" : "outline"}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
            className="rounded-l-none"
            tooltip="Grid view"
          >
            <LayoutGrid size={16} />
          </ButtonWithTooltip>
        </div>

        <ButtonWithTooltip
          size="icon"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh Files"
          isLoading={isRefreshing}
          tooltip="Refresh Files"
          loadingTooltip="Refreshing..."
        >
          <RefreshCcw
            size={16}
            className={cn(
              "transition-transform duration-1000",
              isRefreshing && "animate-spin"
            )}
          />
        </ButtonWithTooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Settings">
              <Settings size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-4">
              <div className="font-medium text-sm">File Settings</div>

              {/* Sorting Options */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as any);
                    updateQueryParams({ sortBy: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Upload Date</SelectItem>
                    <SelectItem value="originalName">File Name</SelectItem>
                    <SelectItem value="size">File Size</SelectItem>
                    <SelectItem value="mimeType">File Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Sort Direction
                </Label>
                <Select
                  value={sortDir}
                  onValueChange={(value) => {
                    setSortDir(value as any);
                    updateQueryParams({ sortDir: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Clear Filters Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="w-full"
              >
                <RotateCcw size={14} className="mr-2" />
                Clear Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
