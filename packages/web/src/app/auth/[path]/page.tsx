import { authViewPaths } from "@daveyplate/better-auth-ui/server";
import { AuthView } from "@daveyplate/better-auth-ui";

// !for some fucking dumb reason github actions always fail here without any explaination
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [
    authViewPaths.SIGN_IN,
    authViewPaths.SIGN_OUT,
    authViewPaths.SIGN_UP,
  ].map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <div className="flex w-screen h-screen justify-center items-center">
      <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
        <AuthView path={path} />
      </main>
    </div>
  );
}
