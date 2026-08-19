import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMonthRange, formatISODate, MONTH_NAMES } from "@/lib/period";
import { formatTimeHHMM, minutesToHHMM, resolveSchedule, MANUAL_OVERRIDE_CODES } from "@/lib/dtr-time";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { PrintButton } from "./print-button";

const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

type AttendanceDayRow = Awaited<ReturnType<typeof prisma.attendanceDay.findMany>>[number];

export default async function DtrPrintPage({
  params,
}: PageProps<"/dtr/[employeeId]/[year]/[month]/print">) {
  const user = await requireUser();
  const { employeeId, year: yearParam, month: monthParam } = await params;

  if (user.role !== "ADMIN" && employeeId !== user.employeeId) notFound();

  const year = Number(yearParam);
  const month = Number(monthParam);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { daySchedules: true },
  });
  if (!employee) notFound();

  const officeHoursLabel =
    employee.scheduleMode === "PER_DAY"
      ? "Varies by day"
      : (() => {
          const schedule = resolveSchedule(employee, 1); // Monday — representative for a uniform CUSTOM/STANDARD schedule
          return schedule.session2
            ? `${minutesToHHMM(schedule.session1.start)}–${minutesToHHMM(schedule.session1.end)} & ${minutesToHHMM(schedule.session2.start)}–${minutesToHHMM(schedule.session2.end)}`
            : `${minutesToHHMM(schedule.session1.start)}–${minutesToHHMM(schedule.session1.end)} (continuous)`;
        })();

  const { dates } = getMonthRange(year, month);
  const days = await prisma.attendanceDay.findMany({
    where: { employeeId, date: { gte: dates[0], lte: dates[dates.length - 1] } },
  });
  const dayMap = new Map(days.map((d) => [formatISODate(d.date), d]));

  const totalUndertimeMinutes = days.reduce((sum, d) => sum + d.lateMinutes, 0);
  const totalHours = Math.floor(totalUndertimeMinutes / 60);
  const totalMinutes = totalUndertimeMinutes % 60;

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: landscape; } }"}</style>

      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">
          Printable Daily Time Record (CS Form No. 48) — two copies per sheet, cut down the middle
        </p>
        <PrintButton />
      </div>

      <div className="mx-auto flex w-fit gap-0 bg-white print:mx-0 print:w-full print:justify-between">
        <div className="border-r border-dashed border-gray-400 pr-6 print:flex-1">
          <DtrFormCopy
            employeeName={employee.name}
            officeAssignment={employee.officeAssignment}
            officeHoursLabel={officeHoursLabel}
            year={year}
            month={month}
            dates={dates}
            dayMap={dayMap}
            totalHours={totalHours}
            totalMinutes={totalMinutes}
          />
        </div>
        <div className="pl-6 print:flex-1">
          <DtrFormCopy
            employeeName={employee.name}
            officeAssignment={employee.officeAssignment}
            officeHoursLabel={officeHoursLabel}
            year={year}
            month={month}
            dates={dates}
            dayMap={dayMap}
            totalHours={totalHours}
            totalMinutes={totalMinutes}
          />
        </div>
      </div>

      <p className="text-right text-xs text-gray-500 print:hidden">Printed {new Date().toLocaleString()}</p>
    </div>
  );
}

function DtrFormCopy({
  employeeName,
  officeAssignment,
  officeHoursLabel,
  year,
  month,
  dates,
  dayMap,
  totalHours,
  totalMinutes,
}: {
  employeeName: string;
  officeAssignment: string;
  officeHoursLabel: string;
  year: number;
  month: number;
  dates: Date[];
  dayMap: Map<string, AttendanceDayRow>;
  totalHours: number;
  totalMinutes: number;
}) {
  return (
    <div className="w-[340px] text-[11px] text-black">
      <p className="text-right text-[10px] font-medium text-primary">Civil Service Form No. 48</p>

      <div className="mb-3 flex items-center gap-2">
        <Image src="/batac-seal.jpg" alt="" width={40} height={40} className="shrink-0" />
        <h1 className="text-base font-bold tracking-wide">DAILY TIME RECORD</h1>
      </div>

      <div className="mb-1 border-b border-black pb-0.5 text-center font-medium">{employeeName}</div>
      <p className="mb-2 text-center text-[10px] italic">(NAME)</p>

      <div className="mb-1 border-b border-black pb-0.5 text-center">{officeAssignment}</div>
      <p className="mb-3 text-center text-[10px] italic">(DEPARTMENT)</p>

      <div className="mb-3 space-y-1">
        <p>
          <span className="italic">For the month of</span>{" "}
          <span className="border-b border-black font-medium">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </p>
        <p>
          <span className="italic">Office hours for arrival and departure</span>{" "}
          <span className="border-b border-black">{officeHoursLabel}</span>
        </p>
        <p>
          <span className="italic">Regular Days</span> <span className="border-b border-black">&nbsp;__________&nbsp;</span>{" "}
          <span className="italic">Saturdays</span> <span className="border-b border-black">&nbsp;__________&nbsp;</span>
        </p>
      </div>

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="text-brand-gold">
            <th rowSpan={2} className="border border-black p-0.5 align-middle">
              Day
            </th>
            <th colSpan={2} className="border border-black p-0.5">
              A.M.
            </th>
            <th colSpan={2} className="border border-black p-0.5">
              P.M.
            </th>
            <th colSpan={2} className="border border-black p-0.5">
              Undertime
            </th>
          </tr>
          <tr className="text-primary">
            <th className="border border-black p-0.5 font-normal">Arrival</th>
            <th className="border border-black p-0.5 font-normal">Departure</th>
            <th className="border border-black p-0.5 font-normal">Arrival</th>
            <th className="border border-black p-0.5 font-normal">Departure</th>
            <th className="border border-black p-0.5 font-normal">Hours</th>
            <th className="border border-black p-0.5 font-normal">Minute</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => {
            const iso = formatISODate(date);
            const day = dayMap.get(iso);
            const isOverride = day ? MANUAL_OVERRIDE_SET.has(day.code) : false;
            const isSpecial =
              day && (isOverride || day.code === "WELLNESS_LEAVE" || day.code === "TRIP_AUTHORIZATION" || day.code === "ABSENT");

            return (
              <tr key={iso}>
                <td className="border border-black p-0.5 text-center text-primary">{date.getUTCDate()}</td>
                {isSpecial ? (
                  <td colSpan={4} className="border border-black p-0.5 text-center italic text-gray-600">
                    {ATTENDANCE_CODE_MAP[day!.code].shortLabel}
                  </td>
                ) : (
                  <>
                    <td className="border border-black p-0.5 text-center">
                      {day?.amArrival ? formatTimeHHMM(day.amArrival) : ""}
                    </td>
                    <td className="border border-black p-0.5 text-center">
                      {day?.amDeparture ? formatTimeHHMM(day.amDeparture) : ""}
                    </td>
                    <td className="border border-black p-0.5 text-center">
                      {day?.pmArrival ? formatTimeHHMM(day.pmArrival) : ""}
                    </td>
                    <td className="border border-black p-0.5 text-center">
                      {day?.pmDeparture ? formatTimeHHMM(day.pmDeparture) : ""}
                    </td>
                  </>
                )}
                <td className="border border-black p-0.5 text-center">
                  {day && day.lateMinutes > 0 ? Math.floor(day.lateMinutes / 60) || "" : ""}
                </td>
                <td className="border border-black p-0.5 text-center">{day && day.lateMinutes > 0 ? day.lateMinutes % 60 : ""}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={5} className="border border-black p-0.5 text-right font-bold">
              TOTAL:
            </td>
            <td className="border border-black p-0.5 text-center font-bold">{totalHours || ""}</td>
            <td className="border border-black p-0.5 text-center font-bold">{totalMinutes || ""}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-2 text-[10px] italic">
        I CERTIFY on my honor that the above is true and correct reports of hours of worked performed, record of
        which was made daily at the end of arrival and departure from office.
      </p>

      <div className="mt-6 mb-1 border-b border-black" />
      <p className="text-[10px] italic">VERIFIED as to prescribed office hours</p>

      <div className="mt-6 mb-1 w-full border-b border-black" />
      <p className="text-center text-[10px]">In-Charge/Supervisor</p>
    </div>
  );
}
