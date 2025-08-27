import { UsersProvider } from "@/contexts/UsersContext";
import CreateUserDialog from "@/features/admin/CreateUserDialog";
import { UsersTable } from "@/features/admin/UsersTable";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  prefetch(
    trpc.admin.getUsers.queryOptions({
      offset: 0,
      limit: 20,
      sortBy: "createdAt",
      sortDir: "desc",
    }),
  );

  return (
    <HydrateClient>
      <UsersProvider>
        <div className="space-y-6">
          <div className="flex">
            <div>
              <h2 className="font-bold text-2xl tracking-tight">Users</h2>
              <p className="text-muted-foreground">
                Manage user accounts and permissions
              </p>
            </div>
            <div className="ml-auto" />
            <CreateUserDialog />
          </div>

          <UsersTable />
        </div>
      </UsersProvider>
    </HydrateClient>
  );
}
