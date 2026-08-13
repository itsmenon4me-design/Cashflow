"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/axios";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export default function Page() {
  const router = useRouter();
  const loginSession = useAuthStore((state) => state.loginSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authService.login({ email: email.trim(), password });

      if (!response.success || !response.data) {
        setError(response.message ?? "Gagal masuk. Periksa kembali email dan kata sandi.");
        return;
      }

      const user = response.user
        ? { name: response.user.full_name || email.split("@")[0], email: response.user.email }
        : { name: email.split("@")[0], email: email.trim() };

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
        setError(message ?? "Email atau kata sandi salah.");
      } else {
        setError("Tidak dapat terhubung ke server. Periksa koneksi dan coba lagi.");
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
          <p className="text-sm text-muted-foreground">Masuk untuk mengelola keuangan Anda</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Gunakan email dan kata sandi akun Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Kata Sandi</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Lupa kata sandi?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Masukkan kata sandi"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
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
                {submitting ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}