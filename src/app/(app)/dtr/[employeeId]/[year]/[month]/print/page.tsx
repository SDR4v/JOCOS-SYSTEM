import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getMonthRange, formatISODate, MONTH_NAMES } from "@/lib/period";
import { formatTimeHHMM, MANUAL_OVERRIDE_CODES } from "@/lib/dtr-time";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { PrintButton } from "./print-button";

const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

export default async function DtrPrintPage({
  params,
}: PageProps<"/dtr/[employeeId]/[year]/[month]/print">) {
  const user = await requireUser();
  const { employeeId, year: yearParam, month: monthParam } = await params;

  if (user.role !== "ADMIN" && employeeId !== user.employeeId) notFound();

  const year = Number(yearParam);
  const month = Number(monthParam);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) notFound();

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
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Printable Daily Time Record (CS Form No. 48)</p>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-2xl bg-white p-8 text-[13px] text-black print:m-0 print:max-w-none print:p-0">
        <p className="text-xs italic">Civil Service Form No. 48</p>
        <h1 className="mb-4 text-center text-xl font-bold tracking-wide">DAILY TIME RECORD</h1>

        <div className="mb-4 border-b border-black pb-1 text-center text-sm font-medium">{employee.name}</div>
        <div className="mb-4 border-b border-black pb-1 text-center text-sm">{employee.officeAssignment}</div>

        <div className="mb-3 flex items-end justify-between text-sm">
          <p>
            <span className="italic">For the month of</span>{" "}
            <span className="font-medium">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </p>
          <p className="text-right">
            <span className="italic">Office hours for arrival and departure</span>
            <br />
            8:00–12:00 &amp; 1:00–5:00
          </p>
        </div>
        <div className="mb-3 flex justify-end gap-8 text-sm">
          <p>Regular Days ____________</p>
          <p>Saturdays ____________</p>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black p-1 align-middle">
                Day
              </th>
              <th colSpan={2} className="border border-black p-1">
                A.M.
              </th>
              <th colSpan={2} className="border border-black p-1">
                P.M.
              </th>
              <th colSpan={2} className="border border-black p-1">
                Undertime
              </th>
            </tr>
            <tr>
              <th className="border border-black p-1 font-normal">Arrival</th>
              <th className="border border-black p-1 font-normal">Departure</th>
              <th className="border border-black p-1 font-normal">Arrival</th>
              <th className="border border-black p-1 font-normal">Departure</th>
              <th className="border border-black p-1 font-normal">Hours</th>
              <th className="border border-black p-1 font-normal">Minute</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const iso = formatISODate(date);
              const day = dayMap.get(iso);
              const isOverride = day ? MANUAL_OVERRIDE_SET.has(day.code) : false;
              const isSpecial = day && (isOverride || day.code === "WELLNESS_LEAVE" || day.code === "TRIP_AUTHORIZATION" || day.code === "ABSENT");

              return (
                <tr key={iso}>
                  <td className="border border-black p-1 text-center">{date.getUTCDate()}</td>
                  {isSpecial ? (
                    <td colSpan={4} className="border border-black p-1 text-center italic text-gray-600">
                      {ATTENDANCE_CODE_MAP[day!.code].shortLabel} — {ATTENDANCE_CODE_MAP[day!.code].label}
                    </td>
                  ) : (
                    <>
                      <td className="border border-black p-1 text-center">
                        {day?.amArrival ? formatTimeHHMM(day.amArrival) : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {day?.amDeparture ? formatTimeHHMM(day.amDeparture) : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {day?.pmArrival ? formatTimeHHMM(day.pmArrival) : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {day?.pmDeparture ? formatTimeHHMM(day.pmDeparture) : ""}
                      </td>
                    </>
                  )}
                  <td className="border border-black p-1 text-center">
                    {day && day.lateMinutes > 0 ? Math.floor(day.lateMinutes / 60) || "" : ""}
                  </td>
                  <td className="border border-black p-1 text-center">
                    {day && day.lateMinutes > 0 ? day.lateMinutes % 60 : ""}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="border border-black p-1 text-right font-bold">
                TOTAL:
              </td>
              <td className="border border-black p-1 text-center font-bold">{totalHours || ""}</td>
              <td className="border border-black p-1 text-center font-bold">{totalMinutes || ""}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-xs italic">
          I CERTIFY on my honor that the above is true and correct reports of hours of worked performed, record of
          which was made daily at the end of arrival and departure from office.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <div className="mb-1 h-8 border-b border-black" />
            <p className="text-center text-xs">Employee Signature</p>
          </div>
          <div>
            <p className="mb-4 text-xs italic">VERIFIED as to prescribed office hours</p>
            <div className="mb-1 h-8 border-b border-black" />
            <p className="text-center text-xs">In-Charge/Supervisor</p>
          </div>
        </div>

        <p className="mt-6 text-right text-xs text-gray-500">Printed {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
