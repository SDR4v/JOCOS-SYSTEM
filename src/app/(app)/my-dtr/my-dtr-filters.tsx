"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES, halfLabel, type Half } from "@/lib/period";

export function MyDtrFilters({ year, month, half }: { year: number; month: number; half: Half }) {
  const router = useRouter();

  function pushParams(next: Partial<{ year: number; month: number; half: Half }>) {
    const params = new URLSearchParams({
      year: String(next.year ?? year),
      month: String(next.month ?? month),
      half: String(next.half ?? half),
    });
    router.push(`/my-dtr?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={String(month)} onValueChange={(value) => pushParams({ month: Number(value) })}>
        <SelectTrigger className="w-36">
          <SelectValue>{MONTH_NAMES[month - 1]}</SelectValue>
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

      <Select value={String(half)} onValueChange={(value) => pushParams({ half: Number(value) as Half })}>
        <SelectTrigger className="w-44">
          <SelectValue>{halfLabel(half)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">{halfLabel(1)}</SelectItem>
          <SelectItem value="2">{halfLabel(2)}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function yearOptions(current: number): number[] {
  const base = new Date().getFullYear();
  const years = new Set([current, base, base - 1, base + 1]);
  return Array.from(years).sort((a, b) => b - a);
}
