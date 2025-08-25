import { Button } from "@/components/ui/button";
import { formatFileSize, formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Ban,
  User,
  UserRoundPen,
} from "lucide-react";
import { UserItem } from "@/trpc/types";

interface UsersTableActionsProps {
  onBanUser: (user: UserItem) => void;
  onUnbanUser: (user: UserItem) => void;
  onEditUser: (user: UserItem) => void;
}

export const createUserColumns = ({
  onBanUser,
  onUnbanUser,
  onEditUser,
}: UsersTableActionsProps): ColumnDef<UserItem>[] => [
  {
    header: "User",
    accessorKey: "name",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">{user.name}</div>
            <div className="text-sm text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
        </div>
      );
    },
    size: 250,
  },
  {
    header: "Role",
    accessorKey: "role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string | null;
      if (!role) return <span className="text-muted-foreground">-</span>;

      return (
        <Badge
          variant={role === "admin" ? "default" : "secondary"}
          className="capitalize"
        >
          {role === "admin" && <ShieldCheck className="w-3 h-3 mr-1" />}
          {role}
        </Badge>
      );
    },
    size: 100,
  },
  {
    header: "Status",
    accessorKey: "banned",
    cell: ({ row }) => {
      const user = row.original;
      const isBanned = user.banned;
      const emailVerified = user.emailVerified;

      if (isBanned) {
        return (
          <Badge variant="destructive">
            <Ban className="w-3 h-3 mr-1" />
            Banned
          </Badge>
        );
      }

      if (!emailVerified) {
        return <Badge variant="outline">Unverified</Badge>;
      }

      return <Badge variant="secondary">Active</Badge>;
    },
    size: 120,
  },
  {
    header: "Storage Usage",
    accessorKey: "usedQuota",
    cell: ({ row }) => {
      const user = row.original;
      const usedQuota = user.usedQuota;
      const quota = user.quota;
      const percentage = quota > 0 ? (usedQuota / quota) * 100 : 0;

      return (
        <div className="text-sm">
          <div className="font-medium">
            {formatFileSize(usedQuota)}
            {quota > 0 && (
              <span className="text-muted-foreground">
                {" / "}
                {formatFileSize(quota)}
              </span>
            )}
          </div>
          {quota > 0 && (
            <div className="text-xs text-muted-foreground">
              {Math.round(percentage)}% used
            </div>
          )}
        </div>
      );
    },
    size: 150,
  },
  {
    header: "Joined",
    accessorKey: "createdAt",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return <div className="text-sm">{formatDate(date)}</div>;
    },
    size: 120,
  },
  {
    header: "Actions",
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Actions for ${user.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditUser(user)}>
              <UserRoundPen className="mr-2 h-4 w-4" />
              Edit User
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.banned ? (
              <DropdownMenuItem onClick={() => onUnbanUser(user)}>
                <Shield className="mr-2 h-4 w-4" />
                Unban User
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onBanUser(user)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Ban User
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 70,
    enableSorting: false,
  },
];
