import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex w-screen h-screen justify-center items-center flex-col gap-4">
      <h1 className="text-3xl font-bold">Not Found</h1>

      <p className="text-lg">
        Sorry, we couldn't find the page you were looking for.
      </p>

      <Button asChild>
        <Link href="/">Go back home</Link>
      </Button>
    </div>
  );
}
