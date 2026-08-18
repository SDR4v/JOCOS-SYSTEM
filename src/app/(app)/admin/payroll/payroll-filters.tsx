"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/period";

type PayrollHalf = "1" | "2" | "combined";

export function PayrollFilters({
  year,
  month,
  half,
}: {
  year: number;
  month: number;
  half: PayrollHalf;
}) {
  const router = useRouter();

  function pushParams(next: Partial<{ year: number; month: number }>) {
    const params = new URLSearchParams({
      year: String(next.year ?? year),
      month: String(next.month ?? month),
      half,
    });
    router.push(`/admin/payroll?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={String(month)} onValueChange={(value) => pushParams({ month: Number(value) })}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(value) => pushParams({ year: Number(value) })}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions(year).map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        {(["1", "2", "combined"] as const).map((h) => (
          <Link key={h} href={`/admin/payroll?year=${year}&month=${month}&half=${h}`}>
            <Button variant={h === half ? "default" : "outline"} size="sm">
              {h === "1" ? "1st half" : h === "2" ? "2nd half" : "Combined"}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}

function yearOptions(current: number): number[] {
  const base = new Date().getFullYear();
  const years = new Set([current, base, base - 1, base + 1]);
  return Array.from(years).sort((a, b) => b - a);
}
