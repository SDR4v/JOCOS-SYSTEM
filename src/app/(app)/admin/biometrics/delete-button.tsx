"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { deleteBiometricUpload } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  return <ActionButton onAction={() => deleteBiometricUpload(id)} icon={Trash2} label="Delete" successMessage="Deleted" />;
}
