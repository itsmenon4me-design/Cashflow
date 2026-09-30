"use client";

import { useState } from "react";
import { Pencil, Save, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/axios";
import { setStoredUser } from "@/lib/auth-token";
import { useUiText } from "@/hooks/useUiText";
import type { UserResponse } from "@/types/backend";

export function ProfileFormInline() {
  const uiText = useUiText();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? user?.name ?? "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authService.updateProfile({ full_name: name.trim() });
      if (res?.success) {
        const updatedFromPatch = res.data;
        if (updatedFromPatch) {
          setUser({
            name: updatedFromPatch.full_name || name.trim(),
            email: updatedFromPatch.email || user?.email || "",
            has_manual_password: user?.has_manual_password,
            avatar_url: updatedFromPatch.avatar_url ?? user?.avatar_url ?? null,
          });
        }
        try {
          const meRes = await apiClient.get<{
            success: boolean;
            data?: UserResponse;
          }>("/auth/me");
          const meData = meRes?.data;
          if (meData) {
            const updated = {
              name: meData.full_name,
              email: meData.email || user?.email || "",
              has_manual_password: meData.has_manual_password ?? null,
              avatar_url: meData.avatar_url ?? null,
            };
            setUser(updated);
            setStoredUser(updated);
          }
        } catch (refreshError) {
          console.warn("[profile-form] profile refresh failed after update", refreshError);
          setError(uiText.settingsPage.nameSavedButRefreshFailed);
        }
        setIsEditing(false);
        setDraftName(null);
      } else {
        setError(res?.message ?? uiText.settingsPage.updateProfileFailed);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftName(null);
    setError(null);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Name field — read-only by default, edit on click */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-name" className="text-xs text-muted-foreground">
          {uiText.settingsPage.name}
        </Label>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setDraftName(e.target.value)}
              className="sm:w-72"
              autoFocus
            />
            <Button
              variant="primary"
              size="icon"
              onClick={handleSave}
              loading={saving}
              aria-label={uiText.settingsPage.save}
            >
              <Save className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancel}
              disabled={saving}
              aria-label={uiText.settingsPage.cancel}
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground min-w-0">
              {user?.name || uiText.settingsPage.userFallback}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditing(true)}
              aria-label={uiText.settingsPage.profileEdit}
            >
              <Pencil className="size-4" />
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Email — always read-only */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-email" className="text-xs text-muted-foreground">
          {uiText.settingsPage.email}
        </Label>
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{user?.email || "—"}</p>
        </div>
      </div>
    </div>
  );
}
