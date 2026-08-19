"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { authService } from "@/services/auth.service";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const id = params.get("id") ?? "";
  const t = uiText.auth;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!token || !id) return t.resetInvalidToken;
    if (!password) return t.resetPasswordRequired;
    if (password.length < 12) return t.resetPasswordMinLength;
    if (password !== confirm) return t.resetPasswordMismatch;
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.resetPassword({
        token,
        id,
        new_password: password,
      });

      if (!response.success) {
        setError(response.message ?? t.resetFailed);
        return;
      }

      setSuccess(t.resetSuccess);
      setTimeout(() => router.replace("/login"), 1600);
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          typeof err.data === "object" && err.data !== null && "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : null;
        setError(message ?? t.resetInvalidToken);
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
            <LockKeyhole className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">CashFlow</h1>
          <p className="text-sm text-muted-foreground">{t.resetSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.resetTitle}</CardTitle>
            <CardDescription>{t.resetDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t.newPassword}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Minimal 12 karakter"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t.confirmNewPassword}</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={submitting}
                />
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
                {submitting ? t.resetProcessing : t.resetAction}
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

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Memuat...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
