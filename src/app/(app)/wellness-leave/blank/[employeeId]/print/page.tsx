import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getDailyRate, formatPeso as peso } from "@/lib/payroll";
import { PrintButton } from "../../../print-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { WellnessLeaveApplicationForm } from "../../../print-form";

export default async function BlankWellnessLeavePrintPage({
  params,
}: PageProps<"/wellness-leave/blank/[employeeId]/print">) {
  const user = await requireUser();
  const { employeeId } = await params;

  if (user.role !== "ADMIN" && employeeId !== user.employeeId) notFound();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) notFound();

  const year = new Date().getFullYear();

  const [sem1Balance, sem2Balance, rate] = await Promise.all([
    prisma.wellnessLeaveBalance.findUnique({
      where: { employeeId_year_semester: { employeeId, year, semester: 1 } },
    }),
    prisma.wellnessLeaveBalance.findUnique({
      where: { employeeId_year_semester: { employeeId, year, semester: 2 } },
    }),
    prisma.salaryGradeRate.findUnique({
      where: { year_salaryGrade: { year, salaryGrade: employee.salaryGrade } },
    }),
  ]);

  const salaryLabel = rate
    ? `${peso(rate.monthlyAmount)}/mo. (${peso(getDailyRate(rate.monthlyAmount))}/day)`
    : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">
          Blank Wellness Leave application for {employee.name} — dates and signatures to be filled in by hand
        </p>
        <div className="flex gap-2">
          <DownloadPdfButton targetId="wellness-leave-print-content" filename={`Wellness-Leave-Blank-${employee.name}.pdf`} />
          <PrintButton />
        </div>
      </div>

      <WellnessLeaveApplicationForm
        employeeName={employee.name}
        officeAssignment={employee.officeAssignment}
        positionTitle={employee.positionTitle}
        salaryLabel={salaryLabel}
        dateOfFilingLabel="____________________"
        semester={null}
        daysLabel="____________________"
        datesLabel="____________________"
        notesLabel="____________________"
        sem1Balance={sem1Balance}
        sem2Balance={sem2Balance}
        lessSem1Label="____"
        lessSem2Label="____"
        filedByLabel="____________________"
        displayStatus={null}
      />
    </div>
  );
}
