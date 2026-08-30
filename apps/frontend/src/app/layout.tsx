import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { setUiTextLanguage } from "@/locales";
import { cn } from "@/lib/utils";
// Single font family: Inter covers the whole UI (latin subset, display swap
// by default via next/font). The previously loaded Geist Sans/Mono families
// were unused (--font-geist-sans had no consumers and nothing renders
// font-mono) and only added font downloads for low-end/mobile devices.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const metadata: Metadata = {
  title: "CashFlow Enterprise",
  description: "Production-first CashFlow enterprise platform blueprint for secure multi-platform financial operations.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CashFlow",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020202",
  colorScheme: "dark light",
  viewportFit: "cover",
};
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render the server HTML in the SAME language the client will hydrate with.
  // The active language is mirrored to a `cashflow.language` cookie by
  // language.store; reading it here makes SSR output match the client's first
  // render and eliminates the hydration mismatch (white flash / tree rebuild)
  // that occurred whenever the persisted language was not the default "id".
  const cookieStore = await cookies();
  const cookieLanguage = cookieStore.get("cashflow.language")?.value;
  setUiTextLanguage(cookieLanguage);

  const cookieTheme = cookieStore.get("cashflow.theme")?.value;
  const isDark = cookieTheme !== "light";

  return (
      <html
        lang="id"
        suppressHydrationWarning
        className={cn("h-full", isDark && "dark", "antialiased", "font-sans", inter.variable)}
      >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='cashflow.theme',t=localStorage.getItem(k);if(t==='light'){document.documentElement.classList.remove('dark');}else if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var cn='cashflow_sidebar_expanded';var c=document.cookie.split(';').find(function(c){return c.trim().startsWith(cn+'=')});if(c){var v=decodeURIComponent(c.split('=')[1]);window.__sidebarExpanded=JSON.parse(v);}else{window.__sidebarExpanded={};}}catch(e){window.__sidebarExpanded={};}})();`,
          }}
        />
        <Script
          id="app-ready-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.__app_html_ready = true;window.__app_client_ready = window.__app_client_ready || false;window.__app_signalHydrated = function(){window.__app_client_ready = true;};window.__app_requestFlush = function(){try{if(window.syncController && typeof window.syncController.flush === 'function'){return window.syncController.flush();}}catch(e){}return null;};}catch(e){} })();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}