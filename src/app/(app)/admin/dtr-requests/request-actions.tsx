"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveDtrEntryRequest,
  rejectDtrEntryRequest,
  approveDtrEntryRequests,
  rejectDtrEntryRequests,
  revertDtrEntryApproval,
} from "./actions";

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
      <Button type="button" size="sm" loading={pending} onClick={approve}>
        <Check />
        Approve
      </Button>
      <Button type="button" variant="outline" size="sm" loading={pending} onClick={reject}>
        <X />
        Reject
      </Button>
    </div>
  );
}

export function BulkApproveRejectButtons({ ids }: { ids: string[] }) {
  const [pending, startTransition] = useTransition();

  function approveAll() {
    startTransition(async () => {
      const result = await approveDtrEntryRequests(ids);
      if (!result.error) toast.success(`Approved ${ids.length} day(s)`);
      else toast.error(result.error);
    });
  }

  function rejectAll() {
    startTransition(async () => {
      const result = await rejectDtrEntryRequests(ids);
      if (!result.error) toast.success(`Rejected ${ids.length} day(s)`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" loading={pending} onClick={approveAll}>
        <Check />
        Approve all ({ids.length})
      </Button>
      <Button type="button" variant="outline" size="sm" loading={pending} onClick={rejectAll}>
        <X />
        Reject all ({ids.length})
      </Button>
    </div>
  );
}

export function EmployeeRequestGroup({
  employeeName,
  count,
  ids,
  children,
  defaultOpen = false,
}: {
  employeeName: string;
  count: number;
  ids: string[];
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          {employeeName}{" "}
          <span className="font-normal text-muted-foreground">
            &middot; {count} day{count === 1 ? "" : "s"} pending
          </span>
        </button>
        <BulkApproveRejectButtons ids={ids} />
      </div>
      {open && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

export function RevertApprovalButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function revert() {
    startTransition(async () => {
      const result = await revertDtrEntryApproval(id);
      if (!result.error) toast.success("Approval reverted — employee can now edit and resubmit this day");
      else toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={pending} onClick={revert}>
      <Undo2 />
      Revert
    </Button>
  );
}
