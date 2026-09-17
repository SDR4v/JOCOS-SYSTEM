import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMonthRange, formatISODate, clampMonth } from "@/lib/period";
import { CalendarGrid } from "./calendar-grid";
import { MonthNav } from "./month-nav";
import { AddStandardHolidaysButton } from "./holiday-actions-client";
import type { DayHoliday } from "./day-dialog";

// Adding a holiday (or "add standard holidays", which does this once per
// holiday in a year) writes one AttendanceDay per active employee — see
// syncHolidayAttendance's own transaction timeout in actions.ts. Set at the
// page level so it covers every Server Action used here (see maxDuration
// docs: it must be set here, not in actions.ts, to affect Server Actions).
export const maxDuration = 60;

export default async function HolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);

  const { start, end } = getMonthRange(year, month);
  const holidays = await prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } });

  const holidaysByDate: Record<string, DayHoliday> = {};
  for (const h of holidays) {
    holidaysByDate[formatISODate(h.date)] = { id: h.id, name: h.name, type: h.type };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Click a day to add or remove a holiday or a suspended-work day. Both mark the day no-work/no-pay — DTR and
          the JOCOS Daily Rate Computation update automatically for every active employee.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav year={year} month={month} />
        <AddStandardHolidaysButton year={year} />
      </div>

      <CalendarGrid year={year} month={month} holidaysByDate={holidaysByDate} />

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary/10" /> Regular Holiday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-brand-gold/10" /> Special (Non-working) Day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-brand-green/10" /> Suspended Work (paid)
        </span>
      </div>
    </div>
  );
}
