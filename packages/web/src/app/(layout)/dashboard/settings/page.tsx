import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UpdateAvatarCard,
  UpdateNameCard,
  ChangePasswordCard,
  SessionsCard,
  DeleteAccountCard,
} from "@daveyplate/better-auth-ui";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="p-4">
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 self-center max-w-md w-full h-10">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
