"use client";

import { DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DayDialog, type DayHoliday } from "./day-dialog";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarCell = {
  date: string; // ISO
  day: number;
  inMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  holiday: DayHoliday | null;
};

export function CalendarGrid({
  year,
  month,
  holidaysByDate,
}: {
  year: number;
  month: number;
  holidaysByDate: Record<string, DayHoliday>;
}) {
  const cells = buildMonthCells(year, month, holidaysByDate);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => (
          <DayDialog
            key={i}
            date={cell.date}
            displayLabel={cell.displayLabel}
            holiday={cell.holiday}
          >
            <DialogTrigger
              render={
                <button
                  type="button"
                  disabled={!cell.inMonth}
                  className={cn(
                    "flex h-24 flex-col items-start gap-1 border-r border-b p-1.5 text-left transition disabled:cursor-default",
                    !cell.inMonth && "bg-muted/20 text-muted-foreground/40",
                    cell.inMonth && !cell.holiday && "hover:bg-accent",
                    cell.holiday?.type === "REGULAR" && "bg-primary/10 hover:bg-primary/15",
                    cell.holiday?.type === "SPECIAL_NON_WORKING" && "bg-brand-gold/10 hover:bg-brand-gold/15",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      cell.isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {cell.day}
                  </span>
                  {cell.holiday && (
                    <span className="line-clamp-2 w-full text-left text-[0.7rem] leading-tight font-medium wrap-break-word">
                      {cell.holiday.name}
                    </span>
                  )}
                </button>
              }
            />
          </DayDialog>
        ))}
      </div>
    </div>
  );
}

function buildMonthCells(
  year: number,
  month: number,
  holidaysByDate: Record<string, DayHoliday>,
): (CalendarCell & { displayLabel: string })[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();

  const now = new Date();
  const todayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const cells: (CalendarCell & { displayLabel: string })[] = [];

  for (let i = 0; i < leadingBlanks; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (leadingBlanks - i)));
    cells.push({
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: false,
      isWeekend: false,
      isToday: false,
      holiday: null,
      displayLabel: "",
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    cells.push({
      date: iso,
      day,
      inMonth: true,
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === todayIso,
      holiday: holidaysByDate[iso] ?? null,
      displayLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
    });
  }

  const trailingBlanks = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailingBlanks; i++) {
    const d = new Date(Date.UTC(year, month - 1, daysInMonth + i));
    cells.push({
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: false,
      isWeekend: false,
      isToday: false,
      holiday: null,
      displayLabel: "",
    });
  }

  return cells;
}
