import "@/styles/globals.css";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getTheme, getThemeList } from "./_actions/theme";
import { Providers } from "./_components/Providers";
import { InlineThemeScript, ThemeProvider } from "./_components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let appName = "Beam";

  try {
    const res = await fetch(`${process.env.BASE_URL}/api/settings`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const settings = await res.json();

    appName = settings.appName;
  } catch {}
  return {
    title: {
      template: `%s - ${appName}`,
      default: appName,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const selectedTheme = await getTheme().catch(() => "default");
  // Pass the selected theme as forcedTheme so ThemeProvider can handle "default" properly
  const forcedThemeForScript = selectedTheme;

  let availableThemes: string[] | undefined;
  let availableThemeDefs:
    | Record<
        string,
        { light: Record<string, string>; dark: Record<string, string> }
      >
    | undefined;
  try {
    const names = await getThemeList().catch(() => [] as string[]);
    if (names && names.length > 0) {
      availableThemes = names;
      availableThemeDefs = {};
      for (const name of names) {
        try {
          const p = join(process.cwd(), "src", "themes", `${name}.json`);
          const txt = readFileSync(p, "utf8");
          availableThemeDefs[name] = JSON.parse(txt);
        } catch {
          // ignore invalid/missing theme file
        }
      }
    }
  } catch {
    // ignore errors and leave themes undefined
  }

  return (
    <html
      lang="en"
      className="theme-prevent-transitions"
      suppressHydrationWarning
    >
      <head>
        {/* Inline pre-hydration script moved to top of head to run before CSS and paint */}
        <InlineThemeScript
          storageKey="theme"
          modeKey="theme-mode"
          defaultTheme={"default"}
          forcedTheme={forcedThemeForScript}
          enableSystem={true}
          enableColorScheme={true}
          availableThemes={availableThemes}
          availableThemeDefs={availableThemeDefs}
        />

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          forcedTheme={forcedThemeForScript}
          availableThemes={availableThemes}
          availableThemeDefs={availableThemeDefs}
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
