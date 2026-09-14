"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitConfidentDaysForReview } from "../actions";

export function ApplyButton({ uploadId, disabled }: { uploadId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await submitConfidentDaysForReview(uploadId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const s = result.summary!;
      toast.success(
        `${s.submitted} day(s) are now pre-filled on employees' My DTR for them to check and submit. ${s.skippedExisting} already had data, ${s.flaggedDays} flagged for review${s.unmatchedPunches > 0 ? `, ${s.unmatchedPunches} punches unmatched to an employee` : ""}.`,
      );
    });
  }

  return (
    <Button type="button" loading={pending} onClick={handleClick} disabled={disabled}>
      <Send />
      Send confident days to employees&apos; DTR
    </Button>
  );
}
