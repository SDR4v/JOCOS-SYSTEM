"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initializeWellnessLeaveBalances } from "./actions";

export function InitializeYearButton({ year }: { year: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await initializeWellnessLeaveBalances(year);
          if (!result.error) toast.success(`Wellness Leave balances initialized for ${year}`);
          else toast.error(result.error);
        });
      }}
    >
      {pending ? "Initializing..." : `Initialize ${year}`}
    </Button>
  );
}
