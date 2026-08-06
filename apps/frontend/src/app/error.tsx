"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { HttpErrorPage } from "@/components/states/HttpErrorPage";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <HttpErrorPage
      statusCode="500"
      title={uiText.states.http500Title}
      description={uiText.states.http500Description}
      icon={TriangleAlert}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="secondary" onClick={retry}>
            {uiText.common.tryAgain}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/")}>
            {uiText.common.backToHome}
          </Button>
        </div>
      }
    />
  );
}