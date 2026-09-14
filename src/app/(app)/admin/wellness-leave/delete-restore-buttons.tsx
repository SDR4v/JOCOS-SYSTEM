"use client";

import { Trash2, Undo2 } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { deleteWellnessLeaveRequest, restoreWellnessLeaveRequest } from "./actions";

export function DeleteRequestButton({ id }: { id: string }) {
  return (
    <ActionButton
      onAction={() => deleteWellnessLeaveRequest(id)}
      icon={Trash2}
      label="Delete"
      successMessage="Request moved to the bin"
    />
  );
}

export function RestoreRequestButton({ id }: { id: string }) {
  return (
    <ActionButton onAction={() => restoreWellnessLeaveRequest(id)} icon={Undo2} label="Restore" successMessage="Request restored" />
  );
}
