"use client";

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

interface DeleteInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteInvestmentDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteInvestmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{uiText.investments.deleteTitle}</DialogTitle>
          <DialogDescription>{uiText.investments.deleteMessage}</DialogDescription>
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