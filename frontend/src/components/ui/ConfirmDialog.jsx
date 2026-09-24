import React from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import Modal from "./Modal";

const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} onClose={onCancel} size="sm">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <AlertTriangle aria-hidden="true" size={18} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[14.5px] font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">{description}</p> : null}
      </div>
    </div>
    <div className="mt-5 flex items-center justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button type="button" variant={tone} onClick={onConfirm} disabled={loading}>
        {loading ? "Please wait..." : confirmLabel}
      </Button>
    </div>
  </Modal>
);

export default ConfirmDialog;
