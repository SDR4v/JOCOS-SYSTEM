"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

// The "click a button, run one server action, toast the result" pattern
// repeated across every admin list page (delete/restore/ignore/link/mark as
// taken/...) — one place for the useTransition + toast wiring instead of a
// near-identical copy per action.
export function ActionButton({
  onAction,
  icon: Icon,
  label,
  successMessage,
  variant = "outline",
  size = "sm",
}: {
  onAction: () => Promise<{ error: string | null }>;
  icon: LucideIcon;
  label: string;
  successMessage: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await onAction();
      if (!result.error) toast.success(successMessage);
      else toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant={variant} size={size} loading={pending} onClick={handleClick}>
      <Icon />
      {label}
    </Button>
  );
}
