"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { GoogleIcon, AppleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { apiClient } from "@/lib/axios";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export default function Page() {
  const router = useRouter();
  const loginSession = useAuthStore((state) => state.loginSession);
  const t = uiText.auth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [appleError, setAppleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
    if (oauthError) {
      setGoogleError(t.oauthError);
    }
  }, []);

  const handleGoogleClick = async () => {
    setGoogleError(null);
    setGoogleSubmitting(true);

    try {
      const response = await authService.googleLogin();
      if (!response.success || !response.url) {
        setGoogleError(response.message ?? t.oauthUnavailable);
        return;
      }

      window.location.assign(response.url);
    } catch {
      setGoogleError(t.oauthUnavailable);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleAppleClick = async () => {
    setAppleError(null);
    setAppleSubmitting(true);

    try {
      const response = await authService.appleLogin();
      if (!response.success || !response.url) {
        setAppleError(response.message ?? t.appleOauthUnavailable);
        return;
      }

      window.location.assign(response.url);
    } catch {
      setAppleError(t.appleOauthUnavailable);
    } finally {
      setAppleSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setGoogleError(null);

    if (!email.trim() || !password) {
      setError(t.loginRequired);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.login({ email: email.trim(), password });

      if (!response.success || !response.data) {
        setError(response.message ?? t.loginFailed);
        return;
      }

      // Login response ships no user object — resolve real name/email/id via /auth/me
      let user: { id?: string; name: string; email: string };
      try {
        const me = await apiClient.get<{ success: boolean; data?: { id?: string; full_name?: string; name?: string; email?: string } }>("/auth/me");
        const d = me.data;
        user = {
          id: d?.id,
          name: d?.full_name || d?.name || email.split("@")[0],
          email: d?.email || email.trim(),
        };
      } catch {
        user = { name: email.split("@")[0], email: email.trim() };
      }

      loginSession({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user,
      });

      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          typeof err.data === "object" && err.data !== null && "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : null;
        setError(message ?? t.loginInvalidCredentials);
      } else {
        setError(t.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">CashFlow</h1>
         <p className="text-sm text-muted-foreground">{t.loginSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
           <CardTitle>{t.loginTitle}</CardTitle>
             <CardDescription>{t.loginCardDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
               <Input
                 id="email"
                 type="email"
                 inputMode="email"
                 autoComplete="email"
                 placeholder="nama@email.com"
                 value={email}
                 onChange={(event) => setEmail(event.target.value)}
                 disabled={submitting}
               />
             </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t.password}</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t.forgotPassword}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t.loginPasswordPlaceholder}
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

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? t.processing : t.loginAction}
              </Button>
            </form>

            <div className="space-y-3 pt-2">
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="bg-background px-2">{t.or}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                loading={googleSubmitting}
                onClick={handleGoogleClick}
              >
                <GoogleIcon className="mr-2 size-4" />
                {googleSubmitting ? t.preparing : t.continueGoogle}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                loading={appleSubmitting}
                onClick={handleAppleClick}
              >
                <AppleIcon className="mr-2 size-4" />
                {appleSubmitting ? t.preparing : t.continueApple}
              </Button>

              {googleError && (
                <p className="text-sm text-destructive" role="alert">
                  {googleError}
                </p>
              )}

              {appleError && (
                <p className="text-sm text-destructive" role="alert">
                  {appleError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t.registerPrompt}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t.registerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}