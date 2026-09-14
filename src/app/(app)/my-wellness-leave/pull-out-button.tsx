"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pullOutMyWellnessLeaveRequest } from "./actions";

export function PullOutButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function pullOut() {
    startTransition(async () => {
      const result = await pullOutMyWellnessLeaveRequest(id);
      if (!result.error) toast.success("Wellness Leave request pulled out");
      else toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={pending} onClick={pullOut}>
      <Undo2 />
      Pull Out
    </Button>
  );
}
