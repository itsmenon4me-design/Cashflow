import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from 'next/script';
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  themeColor: "#020202",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <head>
        <Script id="app-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{
          __html: `(function(){try{window.__app_html_ready = true;window.__app_client_ready = window.__app_client_ready || false;window.__app_signalHydrated = function(){window.__app_client_ready = true;};window.__app_requestFlush = function(){try{if(window.syncController && typeof window.syncController.flush === 'function'){return window.syncController.flush();}}catch(e){}return null;};}catch(e){} })();`,
        }} />
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{
          __html: `(function(){try{var k='cashflow.theme',t=localStorage.getItem(k);var dark=t==='dark';document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark')}})();`,
        }} />
        <Script id="fetch-intercept" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `(function(){try{var _fetch=window.fetch;window.fetch=async function(input, init){var res=await _fetch(input, init);try{var url=typeof input==='string'?input:input?.url;if(url && url.indexOf('/api/v1/settings')!==-1){try{res.clone().json().then(function(body){try{var currency=(body && body.data && body.data.currency) || null; if(currency){ try{ localStorage.setItem('cashflow-dashboard-currency', currency); }catch(e){} try{ console.log('[fetch-intercept] wrote localStorage from /api/v1/settings', { written: currency, now: (typeof localStorage!=='undefined'?localStorage.getItem('cashflow-dashboard-currency'):null), ts: Date.now() }); }catch(e){} try{ window.dispatchEvent(new CustomEvent('cashflow:settings-updated',{detail:{currency}})); }catch(e){} } }catch(e){}});}catch(e){}}}catch(e){}return res;};}catch(e){}})();`,
        }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
