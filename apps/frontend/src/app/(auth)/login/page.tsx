"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { GoogleIcon, GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { apiClient } from "@/lib/axios";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginSession = useAuthStore((state) => state.loginSession);
  const t = uiText.auth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [githubSubmitting, setGithubSubmitting] = useState(false);
  const oauthError = searchParams.get("oauth_error");
  const visibleGoogleError = googleError ?? (
    oauthError && !oauthError.startsWith("github_") ? t.oauthError : null
  );
  const visibleGithubError = githubError ?? (
    oauthError?.startsWith("github_") ? t.githubOauthUnavailable : null
  );

  const handleGoogleClick = () => {
    setGoogleError(null);
    setGoogleSubmitting(true);
    window.location.assign(authService.googleRedirectUrl());
  };

  const handleGithubClick = () => {
    setGithubError(null);
    setGithubSubmitting(true);
    window.location.assign(authService.githubRedirectUrl());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCanResendVerification(false);
    setGoogleError(null);

    if (!email.trim() || !password) {
      setError(t.loginRequired);
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.login({
        email: email.trim(),
        password,
      });

      if (!response.success || !response.data) {
        setError(t.loginInvalidCredentials);
        return;
      }

      let user: {
        id?: string;
        name: string;
        email: string;
        avatar_url?: string | null;
      };
      if (response.user) {
        user = {
          id: response.user.id,
          name: response.user.full_name || response.user.username,
          email: response.user.email,
          avatar_url: response.user.avatar_url,
        };
      } else {
        try {
          const me = await apiClient.get<{
            success: boolean;
            data?: {
              id?: string;
              full_name?: string;
              name?: string;
              email?: string;
              avatar_url?: string | null;
            };
          }>("/auth/me");
          const d = me.data;
          user = {
            id: d?.id,
            name: d?.full_name || d?.name || email.split("@")[0],
            email: d?.email || email.trim(),
            avatar_url: d?.avatar_url ?? null,
          };
        } catch {
          user = { name: email.split("@")[0], email: email.trim() };
        }
      }

      loginSession({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user,
      });

      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        const errorData =
          typeof err.data === "object" && err.data !== null
            ? (err.data as { errorCode?: string; message?: string })
            : {};
        if (errorData.errorCode === "ERR_EMAIL_NOT_VERIFIED") {
          setError(t.emailNotVerified);
          setCanResendVerification(true);
        } else {
          setError(t.loginInvalidCredentials);
        }
      } else {
        setError(t.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    const response = await authService.sendVerification(email.trim());
    setError(response.success ? t.verificationEmailSent : response.message ?? t.verificationEmailFailed);
    setResendingVerification(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1>
            <BrandLogo variant="lockup" alt="neraca" className="h-auto w-40" />
          </h1>
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
                  placeholder={t.email}
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
                    className={showPassword ? "pr-10" : "pr-10 text-transparent caret-foreground"}
                  />
                  {!showPassword && password.length > 0 && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2.5 right-10 flex items-center overflow-hidden whitespace-nowrap text-base text-foreground md:text-sm">
                      {"•".repeat(password.length)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              {canResendVerification && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  loading={resendingVerification}
                  onClick={handleResendVerification}
                >
                  {t.resendVerification}
                </Button>
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
                loading={githubSubmitting}
                onClick={handleGithubClick}
              >
                <GithubIcon className="mr-2 size-4" />
                {githubSubmitting ? t.preparing : t.continueGithub}
              </Button>

              {visibleGoogleError && (
                <p className="text-sm text-destructive" role="alert">
                  {visibleGoogleError}
                </p>
              )}

              {visibleGithubError && (
                <p className="text-sm text-destructive" role="alert">
                  {visibleGithubError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t.registerPrompt}{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            {t.registerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
