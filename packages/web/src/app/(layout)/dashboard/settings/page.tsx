import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadShareXConfig } from "@/features/dashboard/DownloadShareXConfig";
import { authClient } from "@/lib/auth";
import {
  UpdateAvatarCard,
  UpdateNameCard,
  ChangePasswordCard,
  SessionsCard,
  DeleteAccountCard,
} from "@daveyplate/better-auth-ui";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data } = await authClient.getSession({
    fetchOptions: { headers: await headers() },
  });
  const baseUrl = process.env.BASE_URL;

  return (
    <div className="p-4">
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 self-center max-w-md w-full h-10">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sharex">ShareX</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="space-y-6">
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
          <p className="text-sm text-muted-foreground">
            Configure your ShareX integration settings.
          </p>
          {/** @ts-ignore */}
          <DownloadShareXConfig apiKey={data?.user.apiKey} baseUrl={baseUrl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
