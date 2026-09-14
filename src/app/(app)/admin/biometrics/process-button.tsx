"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Cog } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { processBiometricUpload } from "./actions";

export function ProcessButton({
  id,
  label = "Process",
  variant,
}: {
  id: string;
  label?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await processBiometricUpload(id);
      if (result.error) {
        toast.error(result.error);
      } else if (result.droppedRows) {
        toast.warning(`Processed, but ${result.droppedRows} row(s) couldn't be read from the PDF — check with HR if a specific employee looks short on punches`);
      } else {
        toast.success("Processed — punches matched to employees");
      }
    });
  }

  return (
    <Button type="button" size="sm" variant={variant} loading={pending} onClick={handleClick}>
      <Cog />
      {label}
    </Button>
  );
}
