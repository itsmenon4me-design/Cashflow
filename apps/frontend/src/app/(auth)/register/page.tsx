"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { GoogleIcon, AppleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uiText } from "@/locales";
import { ApiError } from "@/lib/axios";
import { authService } from "@/services/auth.service";

export default function Page() {
  const router = useRouter();
  const t = uiText.auth;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  const validate = (): string | null => {
    if (!fullName.trim()) return t.fullNameRequired;
    if (fullName.trim().length < 2) return t.fullNameShort;
    if (!email.trim()) return t.emailRequired;
    if (!password) return t.passwordRequired;
    if (password.length < 12) return t.passwordMinLength;
    if (password !== confirm) return t.passwordMismatch;
    return null;
  };

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
    setSuccess(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        password,
      };

      const res = await authService.register(payload);
      if (!res.success) {
        setError(res.message ?? t.registerFailed);
        return;
      }

      // Attempt to send verification email (non-blocking for registration success)
      try {
        await authService.sendVerification(payload.email);
      } catch {
        // ignore send failures; user still registered
      }

      setSuccess(t.registerSuccess);
      // Redirect to login after a short delay
      setTimeout(() => router.replace("/login"), 1800);
    } catch (err) {
      if (err instanceof ApiError) {
        const message =
          typeof err.data === "object" && err.data !== null && "message" in err.data
            ? String((err.data as { message: unknown }).message)
            : null;
        setError(message ?? t.registerFailed);
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
            <UserPlus className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">CashFlow</h1>
         <p className="text-sm text-muted-foreground">{t.registerSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
           <CardTitle>{t.registerTitle}</CardTitle>
           <CardDescription>{t.registerDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
              <Label htmlFor="fullName">{t.fullName}</Label>
               <Input
                 id="fullName"
                 placeholder={t.fullName}
                 value={fullName}
                 onChange={(e) => setFullName(e.target.value)}
                 disabled={submitting}
               />
             </div>



              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Minimal 12 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{t.confirmPassword}</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Ketik ulang kata sandi"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {submitting ? t.processing : t.registerAction}
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
          {t.alreadyHaveAccountPrompt}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.loginInstead}
          </Link>
        </p>
      </div>
    </div>
  );
}
