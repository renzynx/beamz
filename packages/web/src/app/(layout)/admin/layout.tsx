import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
