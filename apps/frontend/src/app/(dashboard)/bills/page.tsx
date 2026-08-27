import { PagePlaceholder } from "@/components/common/page-placeholder";
import { uiText } from "@/locales";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{uiText.navigation.bills}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola tagihan rutin Anda.</p>
      </div>

      <PagePlaceholder title={uiText.navigation.bills} />
    </div>
  );
}