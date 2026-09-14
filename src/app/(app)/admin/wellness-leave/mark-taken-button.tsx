"use client";

import { CheckCheck } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { markWellnessLeaveTaken } from "./actions";

export function MarkTakenButton({ id }: { id: string }) {
  return (
    <ActionButton onAction={() => markWellnessLeaveTaken(id)} icon={CheckCheck} label="Mark as Taken" successMessage="Marked as taken" />
  );
}
