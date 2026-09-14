"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeCombobox, type EmployeeOption } from "@/components/employee-combobox";
import { MONTH_NAMES, halfLabel, type Half } from "@/lib/period";

export function DtrFilters({
  employees,
  employeeId,
  year,
  month,
  half,
}: {
  employees: EmployeeOption[];
  employeeId: string;
  year: number;
  month: number;
  half: Half;
}) {
  const router = useRouter();

  function pushParams(next: Partial<{ employeeId: string; year: number; month: number; half: Half }>) {
    const nextYear = next.year ?? year;
    const nextMonth = next.month ?? month;
    const nextHalf = next.half ?? half;
    const params = new URLSearchParams({
      employeeId: next.employeeId ?? employeeId,
      year: String(nextYear),
      month: String(nextMonth),
      half: String(nextHalf),
    });
    // Remembered so navigating back to DTR from elsewhere (the nav link
    // carries neither an employeeId nor a period of its own) resumes here
    // instead of always resetting to the first employee and current month.
    if (next.employeeId) {
      document.cookie = `jocos-last-dtr-employee=${next.employeeId}; path=/; max-age=${60 * 60 * 24 * 365}`;
    }
    document.cookie = `jocos-last-dtr-period=${nextYear}:${nextMonth}:${nextHalf}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(`/admin/dtr?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <EmployeeCombobox
        employees={employees}
        value={employeeId}
        onValueChange={(id) => pushParams({ employeeId: id })}
        placeholder="Search employee..."
        className="w-72"
      />

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
