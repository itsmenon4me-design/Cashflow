import { SettingsPage } from "@/features/settings/settings-page";

// Server-side render trace for hydration diagnostics. This will appear in the
// Next.js server stdout when the /settings page is rendered on the server.
try {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line no-console
    console.trace('[ssr] Rendering /settings server-side', { ts: Date.now(), stack: (new Error()).stack });
  }
} catch (e) {}

export default function Page() {
  return <SettingsPage />;
}