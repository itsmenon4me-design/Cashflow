"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Mail, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/axios";
import { setStoredUser } from "@/lib/auth-token";

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local name when the store user changes (e.g. after hydration)
  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authService.updateProfile({ full_name: name.trim() });
      if (res?.success) {
        // Refresh user data via /me + update localStorage/authStore supaya konsisten setelah reload
        try {
          // apiClient already unwraps HTTP body: response IS { success, data }
          const meRes = await apiClient.get<{ success: boolean; data: any }>("/auth/me");
          const meData = meRes?.data;
          if (meData) {
            const updated = { id: meData.id, name: meData.full_name || meData.name, email: meData.email || user?.email };
            setUser(updated);
            setStoredUser(updated);
          }
        } catch { /* fallback: optimistic update */ }
        setIsEditing(false);
      } else {
        setError(res?.message ?? "Failed to update profile");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name ?? "");
    setError(null);
    setIsEditing(false);
  };

  const SectionHeading = ({ icon: Icon, title, subtitle }: { icon: typeof UserIcon; title: string; subtitle: string }) => (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {uiText.navigation.profile}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {uiText.settingsPage.accountSubtitle}
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeading icon={UserIcon} title={uiText.settingsPage.account} subtitle={uiText.settingsPage.accountSubtitle} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name field — read-only by default, edit on click */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs text-muted-foreground">{uiText.settingsPage.name}</Label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="sm:w-72"
                  autoFocus
                />
                <Button variant="primary" size="icon" onClick={handleSave} loading={saving} aria-label={uiText.common.save}>
                  <Save className="size-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleCancel} disabled={saving} aria-label={uiText.common.cancel}>
                  <span className="text-lg leading-none">×</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground min-w-0">
                  {user?.name || uiText.common.user}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsEditing(true)}
                  aria-label={uiText.common.edit}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Email — always read-only */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs text-muted-foreground">{uiText.settingsPage.email}</Label>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{user?.email || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
