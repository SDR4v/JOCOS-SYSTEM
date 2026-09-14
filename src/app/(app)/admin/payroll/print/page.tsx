import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computePayroll, formatPeso, type PayrollTotals } from "@/lib/payroll";
import { getHalfMonthRange, formatISODate, MONTH_NAMES, clampMonth } from "@/lib/period";
import { ATTENDANCE_CODE_MAP, displayCodeForDay } from "@/lib/attendance-codes";
import { PrintControls } from "./print-controls";

type PayrollHalf = "1" | "2" | "combined";
type AttendanceDayRow = Awaited<
  ReturnType<typeof prisma.attendanceDay.findMany>
>[number];

export default async function PayrollPrintPage({
  searchParams,
}: PageProps<"/admin/payroll/print">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);
  const half: PayrollHalf =
    params.half === "1" || params.half === "2" ? params.half : "combined";

  const range1 = getHalfMonthRange(year, month, 1);
  const range2 = getHalfMonthRange(year, month, 2);
  const dates =
    half === "1"
      ? range1.dates
      : half === "2"
        ? range2.dates
        : [...range1.dates, ...range2.dates];
  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
  });
  employees.sort((a, b) => Number(a.employeeNo) - Number(b.employeeNo));

  const rates = await prisma.salaryGradeRate.findMany({ where: { year } });
  const rateMap = new Map(rates.map((r) => [r.salaryGrade, r.monthlyAmount]));

  const days = employees.length
    ? await prisma.attendanceDay.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          date: { gte: rangeStart, lte: rangeEnd },
        },
      })
    : [];

  const dayMapByEmployee = new Map<string, Map<string, AttendanceDayRow>>();
  for (const day of days) {
    const map = dayMapByEmployee.get(day.employeeId) ?? new Map();
    map.set(formatISODate(day.date), day);
    dayMapByEmployee.set(day.employeeId, map);
  }

  type ReportRow = {
    employee: (typeof employees)[number];
    dayMap: Map<string, AttendanceDayRow>;
    totals: PayrollTotals;
  };

  const rows: ReportRow[] = employees.map((employee) => {
    const monthlyAmount = rateMap.get(employee.salaryGrade) ?? 0;
    const dayMap = dayMapByEmployee.get(employee.id) ?? new Map();
    const dayInputs = dates.map((date) => {
      const day = dayMap.get(formatISODate(date));
      return {
        dayCredit: day?.dayCredit ?? 0,
        lateMinutes: day?.lateMinutes ?? 0,
      };
    });
    const totals = computePayroll(dayInputs, monthlyAmount);
    return { employee, dayMap, totals };
  });

  const halfLabel =
    half === "1" ? "1ST HALF" : half === "2" ? "SECOND HALF" : "WHOLE MONTH";
  const bandColor = half === "2" ? "#ED7D31" : "#4472C4";
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const NAVY = "#1F3864";
  const DEDUCTION_BG = "#DDEBF7";
  const SALARY_BG = "#E2EFDA";
  const EMPTY_ROW_BG = "#FFF2CC";

  return (
    <div className="space-y-4">
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 0.3in; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      <PrintControls
        defaultDate={new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        filename={`Payroll-${periodLabel.replace(/\s+/g, "-")}-${halfLabel.replace(/\s+/g, "-")}.pdf`}
      >
        <div className="text-black">
          <h1 className="text-sm font-bold">ATTENDANCE MONITORING</h1>
          <p className="text-sm">
            CONTRACT OF SERVICE (COS) WORKERS — {halfLabel}
          </p>
          <p className="text-sm">
            FOR THE MONTH OF {periodLabel.toUpperCase()}
          </p>

          <table className="mt-2 w-full border-collapse text-[8px] leading-none">
            <thead>
              <tr style={{ backgroundColor: NAVY, color: "white" }}>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Office Assignment
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  No.
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Name
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Position Title
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  SG
                </th>
                <th
                  colSpan={dates.length}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: bandColor }}
                >
                  {halfLabel}
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Total Days Rendered
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Gross Amount Earned
                </th>
                <th rowSpan={3} className="border border-black px-1 py-0.5">
                  Undertime in Minutes
                </th>
                <th
                  colSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: DEDUCTION_BG, color: "black" }}
                >
                  Undertime Deduction
                </th>
                <th
                  colSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: SALARY_BG, color: "black" }}
                >
                  Salary Details
                </th>
              </tr>
              <tr style={{ backgroundColor: bandColor }}>
                {dates.map((date) => (
                  <th
                    key={formatISODate(date)}
                    className="border border-black px-0.5 py-0.5 font-normal"
                  >
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: DEDUCTION_BG, color: "black" }}
                >
                  Deduction
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: DEDUCTION_BG, color: "black" }}
                >
                  Net Amount Earned After Undertime
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: SALARY_BG, color: "black" }}
                >
                  Daily Rate
                </th>
                <th
                  rowSpan={2}
                  className="border border-black px-1 py-0.5"
                  style={{ backgroundColor: SALARY_BG, color: "black" }}
                >
                  Per Minute Rate
                </th>
              </tr>
              <tr style={{ backgroundColor: bandColor }}>
                {dates.map((date) => (
                  <th
                    key={formatISODate(date)}
                    className="border border-black px-0.5 py-0.5 font-normal"
                  >
                    {String(date.getUTCDate()).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee, dayMap, totals }) => {
                const hasNoData = totals.totalDaysRendered === 0 && totals.grossAmount === 0;
                const rowBg = hasNoData ? EMPTY_ROW_BG : undefined;
                return (
                  <tr key={employee.id} style={{ backgroundColor: rowBg }}>
                    <td className="border border-black px-1 py-0.5">
                      {employee.officeAssignment}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {employee.employeeNo}
                    </td>
                    <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                      {employee.name}
                    </td>
                    <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                      {employee.positionTitle}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {employee.salaryGrade}
                    </td>
                    {dates.map((date) => {
                      const day = dayMap.get(formatISODate(date));
                      const code = day?.code ?? "UNSET";
                      return (
                        <td
                          key={formatISODate(date)}
                          className="border border-black px-0.5 py-0.5 text-center"
                          title={ATTENDANCE_CODE_MAP[code].label}
                        >
                          {displayCodeForDay(code, day?.lateMinutes ?? 0)}
                        </td>
                      );
                    })}
                    <td className="border border-black px-1 py-0.5 text-center">
                      {totals.totalDaysRendered.toFixed(1)}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right">
                      {formatPeso(totals.grossAmount, false)}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">
                      {totals.undertimeMinutes}
                    </td>
                    <td
                      className="border border-black px-1 py-0.5 text-right"
                      style={{ backgroundColor: hasNoData ? rowBg : DEDUCTION_BG }}
                    >
                      {formatPeso(totals.deduction, false)}
                    </td>
                    <td
                      className="border border-black px-1 py-0.5 text-right font-medium"
                      style={{ backgroundColor: hasNoData ? rowBg : DEDUCTION_BG }}
                    >
                      {formatPeso(totals.netAmount, false)}
                    </td>
                    <td
                      className="border border-black px-1 py-0.5 text-right"
                      style={{ backgroundColor: hasNoData ? rowBg : SALARY_BG }}
                    >
                      {formatPeso(totals.dailyRate, false)}
                    </td>
                    <td
                      className="border border-black px-1 py-0.5 text-right"
                      style={{ backgroundColor: hasNoData ? rowBg : SALARY_BG }}
                    >
                      {totals.perMinuteRate.toFixed(5)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-2 flex gap-4 text-[8px]">
            <span className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 border border-black"
                style={{ backgroundColor: EMPTY_ROW_BG }}
              />
              No attendance recorded for this period
            </span>
          </div>
        </div>
      </PrintControls>
    </div>
  );
}
