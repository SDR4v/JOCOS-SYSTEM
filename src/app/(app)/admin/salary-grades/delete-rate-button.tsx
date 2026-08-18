"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteSalaryGradeRate } from "./actions";

export function DeleteRateButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await deleteSalaryGradeRate(id);
          toast.success("Rate deleted");
        });
      }}
    >
      Delete
    </Button>
  );
}
