"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uiText } from "@/locales";

interface DeleteSavingGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteSavingGoalDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteSavingGoalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </div>
          <DialogTitle>{uiText.savingGoals.deleteTitle}</DialogTitle>
          <DialogDescription>{uiText.savingGoals.deleteMessage}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {uiText.common.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {uiText.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}