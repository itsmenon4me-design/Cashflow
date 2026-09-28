import { cookies } from "next/headers";
import { getUiText } from "@/locales";

export default async function DashboardRouteLoading() {
  const language = (await cookies()).get("cashflow.language")?.value;
  const loadingText = getUiText(language).common.preparingPage;

  return (
    <div
      role="status"
      aria-label={loadingText}
      aria-busy="true"
      className="flex min-h-[calc(100dvh-8rem)] items-center justify-center"
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground motion-reduce:animate-none"
      />
      <span className="sr-only">{loadingText}</span>
    </div>
  );
}
