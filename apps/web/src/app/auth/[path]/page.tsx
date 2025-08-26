import { AuthView } from "@daveyplate/better-auth-ui";

export default async function AuthPage({
	params,
}: {
	params: Promise<{ path: string }>;
}) {
	const { path } = await params;

	return (
		<div className="flex h-screen w-screen items-center justify-center">
			<main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
				<AuthView path={path} />
			</main>
		</div>
	);
}
