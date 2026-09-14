"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/period";

export function MonthNav({ year, month }: { year: number; month: number }) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const now = new Date();

  return (
    <div className="flex items-center gap-2">
      <Link href={`/admin/holidays?year=${prev.year}&month=${prev.month}`}>
        <Button type="button" variant="outline" size="sm">
          <ChevronLeft />
        </Button>
      </Link>
      <span className="w-40 text-center text-base font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Link href={`/admin/holidays?year=${next.year}&month=${next.month}`}>
        <Button type="button" variant="outline" size="sm">
          <ChevronRight />
        </Button>
      </Link>
      <Link href={`/admin/holidays?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}>
        <Button type="button" variant="outline" size="sm">
          Today
        </Button>
      </Link>
    </div>
  );
}
