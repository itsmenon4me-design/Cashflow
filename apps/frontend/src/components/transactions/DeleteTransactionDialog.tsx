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

interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteTransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{uiText.transactions.deleteTitle}</DialogTitle>
          <DialogDescription>{uiText.transactions.deleteMessage}</DialogDescription>
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
