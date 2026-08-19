"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { authService } from "@/services/auth.service";

export default function Page() {
  const t = uiText.auth;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t.forgotInvalidEmail);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.forgotPassword(trimmed);
      if (!response.success) {
        setError(response.message ?? t.forgotRequestFailed);
        return;
      }

      setEmail("");
      setSuccess(t.forgotSuccess);
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          typeof err.data === "object" && err.data !== null && "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : null;
        setError(message ?? t.forgotRequestFailed);
      } else {
        setError(t.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">CashFlow</h1>
          <p className="text-sm text-muted-foreground">{t.forgotSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.forgotTitle}</CardTitle>
            <CardDescription>{t.forgotDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={submitting}
                    className="pl-10"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-success" role="status">
                  {success}
                </p>
              )}

              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? t.forgotSending : t.forgotAction}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t.alreadyHaveAccountPrompt}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.loginInstead}
          </Link>
        </p>
      </div>
    </div>
  );
}