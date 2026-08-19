"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveDtrEntryRequest, rejectDtrEntryRequest } from "./actions";

export function ApproveRejectButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveDtrEntryRequest(id);
      if (!result.error) toast.success("DTR entry approved");
      else toast.error(result.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectDtrEntryRequest(id);
      if (!result.error) toast.success("DTR entry rejected");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={approve}>
        Approve
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reject}>
        Reject
      </Button>
    </div>
  );
}
