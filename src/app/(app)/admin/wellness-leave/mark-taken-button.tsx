"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWellnessLeaveTaken } from "./actions";

export function MarkTakenButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function markTaken() {
    startTransition(async () => {
      const result = await markWellnessLeaveTaken(id);
      if (!result.error) toast.success("Marked as taken");
      else toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={markTaken}>
      <CheckCheck />
      Mark as Taken
    </Button>
  );
}
