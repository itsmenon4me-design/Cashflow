"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, Mail, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/axios";
import { setStoredUser } from "@/lib/auth-token";

export function ProfileFormInline() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const updatedFromPatch = res.data;
        if (updatedFromPatch) {
          setUser({
            name: updatedFromPatch.full_name || updatedFromPatch.name || name.trim(),
            email: updatedFromPatch.email || user?.email || "",
          });
        }
        try {
          const meRes = await apiClient.get<{ success: boolean; data: any }>("/auth/me");
          const meData = meRes?.data;
          if (meData) {
            const updated = { name: meData.full_name || meData.name, email: meData.email || user?.email };
            setUser(updated);
            setStoredUser(updated);
          }
        } catch (refreshError) {
          console.warn("[profile-form] profile refresh failed after update", refreshError);
          setError("Nama tersimpan, tetapi profil terbaru gagal dimuat. Silakan refresh halaman.");
        }
        setIsEditing(false);
      } else {
        setError(res?.message ?? "Gagal memperbarui profil");
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

  return (
    <div className="space-y-4">
      {/* Name field — read-only by default, edit on click */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-name" className="text-xs text-muted-foreground">
          Nama
        </Label>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:w-72"
              autoFocus
            />
            <Button
              variant="primary"
              size="icon"
              onClick={handleSave}
              loading={saving}
              aria-label="Simpan"
            >
              <Save className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancel}
              disabled={saving}
              aria-label="Batal"
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground min-w-0">
              {user?.name || "Pengguna"}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsEditing(true)}
              aria-label="Edit"
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
          Email
        </Label>
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{user?.email || "—"}</p>
        </div>
      </div>
    </div>
  );
}
