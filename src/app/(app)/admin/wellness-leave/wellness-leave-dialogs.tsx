"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveWellnessLeaveRequest, rejectWellnessLeaveRequest } from "./actions";

export function ApproveRejectButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveWellnessLeaveRequest(id);
      if (!result.error) toast.success("Request approved");
      else toast.error(result.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectWellnessLeaveRequest(id);
      if (!result.error) toast.success("Request rejected");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={approve}>
        <Check />
        Approve
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reject}>
        <X />
        Reject
      </Button>
    </div>
  );
}
