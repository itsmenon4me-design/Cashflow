import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

import { HttpErrorPage } from "@/components/states/HttpErrorPage";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

export default function NotFoundErrorPage() {
  return (
    <HttpErrorPage
      statusCode="404"
      title={uiText.states.http404Title}
      description={uiText.states.http404Description}
      icon={FileQuestion}
      action={
        <Button asChild variant="secondary">
          <Link href="/">
            <Home />
            {uiText.common.backToHome}
          </Link>
        </Button>
      }
    />
  );
}
