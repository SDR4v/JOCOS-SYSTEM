import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMonthRange, formatISODate, clampMonth } from "@/lib/period";
import { CalendarGrid } from "./calendar-grid";
import { MonthNav } from "./month-nav";
import { AddStandardHolidaysButton } from "./holiday-actions-client";
import type { DayHoliday } from "./day-dialog";

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
          Click a day to add or remove a holiday. Adding one marks it as a no-work, no-pay day for every active
          employee — DTR and the JOCOS Daily Rate Computation update automatically, the same way a rest day does.
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
      </div>
    </div>
  );
}
