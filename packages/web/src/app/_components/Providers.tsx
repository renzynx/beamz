"use client";

import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { createAuthClient as createAuthClientReact } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authClient] = useState(() =>
    createAuthClientReact({
      basePath: "/api/auth",
      plugins: [adminClient()],
      user: {
        additionalFields: {
          quota: {
            type: "number",
            required: false,
            defaultValue: 0,
            input: false,
          },
          usedQuota: {
            type: "number",
            required: false,
            defaultValue: 0,
            input: false,
          },
        },
      },
    })
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TRPCReactProvider>
        <AuthQueryProvider>
          <AuthUIProviderTanstack
            authClient={authClient}
            navigate={router.push}
            replace={router.replace}
            onSessionChange={() => router.refresh()}
            Link={Link}
            account={{
              basePath: "/dashboard",
            }}
            deleteUser
          >
            {children}
          </AuthUIProviderTanstack>
        </AuthQueryProvider>
      </TRPCReactProvider>
      <Toaster richColors closeButton position="bottom-center" />
    </NextThemesProvider>
  );
}
