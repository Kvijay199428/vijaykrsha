import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface DeleteMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export default function DeleteMessageDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
}: DeleteMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm neu-btn"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm neu-btn font-medium flex items-center gap-2 ${
              danger ? "text-red-500" : ""
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
