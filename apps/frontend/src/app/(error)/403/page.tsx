import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { HttpErrorPage } from "@/components/states/HttpErrorPage";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

export default function ForbiddenPage() {
  return (
    <HttpErrorPage
      statusCode="403"
      title={uiText.states.http403Title}
      description={uiText.states.http403Description}
      icon={ShieldAlert}
      action={
        <Button asChild variant="secondary">
          <Link href="/">{uiText.common.backToHome}</Link>
        </Button>
      }
    />
  );
}
