"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { deleteSalaryGradeRate } from "./actions";

export function DeleteRateButton({ id }: { id: string }) {
  return <ActionButton onAction={() => deleteSalaryGradeRate(id)} icon={Trash2} label="Delete" successMessage="Rate deleted" />;
}
