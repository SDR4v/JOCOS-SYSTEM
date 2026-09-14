"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addStandardHolidays } from "./actions";

export function AddStandardHolidaysButton({ year }: { year: number }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await addStandardHolidays(year);
      if (!result.error) {
        toast.success(
          result.added && result.added > 0
            ? `Added ${result.added} standard holiday(s) for ${year}`
            : `All standard holidays for ${year} were already on the calendar`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} loading={pending}>
      <Sparkles />
      {pending ? "Adding..." : `Add standard PH holidays for ${year}`}
    </Button>
  );
}
