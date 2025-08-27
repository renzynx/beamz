import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <h1 className="font-bold text-3xl">Not Found</h1>

      <p className="text-lg">
        Sorry, we couldn't find the page you were looking for.
      </p>

      <Button asChild>
        <Link href="/">Go back home</Link>
      </Button>
    </div>
  );
}
