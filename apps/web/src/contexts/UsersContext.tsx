"use client";

import type { PaginationState } from "@tanstack/react-table";
import type React from "react";
import { createContext, useContext, useState } from "react";

interface UsersContextType {
  // Pagination
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;

  // Sorting
  sortBy: "createdAt" | "name" | "email" | "usedQuota" | "quota";
  setSortBy: React.Dispatch<
    React.SetStateAction<"createdAt" | "name" | "email" | "usedQuota" | "quota">
  >;
  sortDir: "asc" | "desc";
  setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>;

  // Selection
  selectedUsers: string[];
  selectAllUsers: (userIds: string[]) => void;
  deselectAllUsers: () => void;
  toggleUserSelection: (userId: string) => void;
  isUserSelected: (userId: string) => boolean;
}

const UsersContext = createContext<UsersContextType | null>(null);

interface UsersProviderProps {
  children: React.ReactNode;
}

export function UsersProvider({ children }: UsersProviderProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const [sortBy, setSortBy] = useState<
    "createdAt" | "name" | "email" | "usedQuota" | "quota"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const selectAllUsers = (userIds: string[]) => {
    setSelectedUsers(userIds);
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const isUserSelected = (userId: string) => {
    return selectedUsers.includes(userId);
  };

  const value: UsersContextType = {
    pagination,
    setPagination,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    selectedUsers,
    selectAllUsers,
    deselectAllUsers,
    toggleUserSelection,
    isUserSelected,
  };

  return (
    <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
  );
}

export function useUsersContext() {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error("useUsersContext must be used within a UsersProvider");
  }
  return context;
}
