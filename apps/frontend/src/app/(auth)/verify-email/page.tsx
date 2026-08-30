"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";
import { authService } from "@/services/auth.service";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const id = params.get("id") ?? "";
  const t = uiText.auth;

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!token || !id) {
      setLoading(false);
      setError(t.verifyEmailInvalidToken);
      return;
    }

    authService
      .verifyEmail(token, id)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setSuccess(true);
          setTimeout(() => {
            router.replace("/login");
          }, 2000);
        } else {
          setError(res.message ?? t.verifyEmailInvalidToken);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err) || t.genericError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, id, router, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MailCheck className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">CashFlow</h1>
          <p className="text-sm text-muted-foreground">{t.verifyEmailSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.verifyEmailTitle}</CardTitle>
            <CardDescription>
              {loading
                ? t.verifyEmailProcessing
                : success
                  ? t.verifyEmailSuccess
                  : error}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-2 pb-6">
            {loading ? (
              <Loader2 className="size-10 animate-spin text-primary" />
            ) : success ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="size-12 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {t.verifyEmailSuccess}
                </p>
                <Button className="mt-2 w-full" onClick={() => router.replace("/login")}>
                  {t.loginInstead}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <XCircle className="size-12 text-destructive" />
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
                <Button variant="outline" className="mt-2 w-full" onClick={() => router.replace("/login")}>
                  {t.loginInstead}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.loginInstead}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Memuat...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
