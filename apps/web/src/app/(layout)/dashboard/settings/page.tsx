import {
	ChangePasswordCard,
	DeleteAccountCard,
	SessionsCard,
	UpdateAvatarCard,
	UpdateNameCard,
} from "@daveyplate/better-auth-ui";
import { headers } from "next/headers";
import { getTheme, getThemeList } from "@/app/_actions/theme";
import ThemeSelect from "@/components/ThemeSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadShareXConfig } from "@/features/dashboard/DownloadShareXConfig";
import { authClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const { data } = await authClient.getSession({
		fetchOptions: { headers: await headers() },
	});
	const baseUrl = process.env.BASE_URL;

	// load current theme and available themes from server actions
	const selectedTheme = await getTheme().catch(() => "default");
	const themeNames = await getThemeList().catch(() => [] as string[]);

	return (
		<div className="p-4">
			<Tabs defaultValue="profile">
				<TabsList className="mb-4 h-10 w-full max-w-md self-center">
					<TabsTrigger value="profile">Profile</TabsTrigger>
					<TabsTrigger value="security">Security</TabsTrigger>
					<TabsTrigger value="sharex">ShareX</TabsTrigger>
				</TabsList>
				<TabsContent value="profile" className="space-y-6">
					<div className="space-y-2">
						<h3 className="font-medium">Appearance</h3>
						<p className="text-muted-foreground text-sm">
							Choose your UI theme.
						</p>
						<ThemeSelect themes={themeNames} currentTheme={selectedTheme} />
					</div>
					<UpdateAvatarCard />
					<UpdateNameCard />
				</TabsContent>

				<TabsContent value="security" className="space-y-6">
					<ChangePasswordCard />
					<SessionsCard />
					<DeleteAccountCard />
				</TabsContent>

				<TabsContent value="sharex" className="space-y-6">
					<h3 className="font-medium">ShareX Settings</h3>
					<p className="text-muted-foreground text-sm">
						Configure your ShareX integration settings.
					</p>
					{/** @ts-ignore */}
					<DownloadShareXConfig apiKey={data?.user.apiKey} baseUrl={baseUrl} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
