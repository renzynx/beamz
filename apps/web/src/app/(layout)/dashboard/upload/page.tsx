import { FileUpload } from "@/features/upload/FileUpload";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  prefetch(trpc.settings.public.queryOptions());

  return (
    <HydrateClient>
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="font-bold text-3xl">File Upload</h1>
        </div>

        <FileUpload />
      </div>
    </HydrateClient>
  );
}
