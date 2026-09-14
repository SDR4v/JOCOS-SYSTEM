import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatISODate } from "@/lib/period";
import { getSemester, wellnessLeaveDisplayStatus } from "@/lib/wellness-leave";
import { getDailyRate, formatPeso as peso } from "@/lib/payroll";
import { PrintButton } from "../../print-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { WellnessLeaveApplicationForm } from "../../print-form";

export default async function WellnessLeavePrintPage({ params }: PageProps<"/wellness-leave/[id]/print">) {
  const user = await requireUser();
  const { id } = await params;

  const request = await prisma.wellnessLeaveRequest.findUnique({
    where: { id },
    include: { employee: true, requestedBy: true, cancelledBy: true, confirmedTakenBy: true },
  });
  if (!request) notFound();
  if (user.role !== "ADMIN" && request.employeeId !== user.employeeId) notFound();

  const semester = getSemester(request.startDate);
  const year = request.startDate.getUTCFullYear();

  const [sem1Balance, sem2Balance, rate] = await Promise.all([
    prisma.wellnessLeaveBalance.findUnique({
      where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester: 1 } },
    }),
    prisma.wellnessLeaveBalance.findUnique({
      where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester: 2 } },
    }),
    prisma.salaryGradeRate.findUnique({
      where: { year_salaryGrade: { year, salaryGrade: request.employee.salaryGrade } },
    }),
  ]);

  const salaryLabel = rate
    ? `${peso(rate.monthlyAmount)}/mo. (${peso(getDailyRate(rate.monthlyAmount))}/day)`
    : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Printable Application for Wellness Leave</p>
        <div className="flex gap-2">
          <DownloadPdfButton
            targetId="wellness-leave-print-content"
            filename={`Wellness-Leave-${request.employee.name}.pdf`}
          />
          <PrintButton />
        </div>
      </div>

      <WellnessLeaveApplicationForm
        employeeName={request.employee.name}
        officeAssignment={request.employee.officeAssignment}
        positionTitle={request.employee.positionTitle}
        salaryLabel={salaryLabel}
        dateOfFilingLabel={formatISODate(request.createdAt)}
        semester={semester}
        daysLabel={`${request.daysCount} day(s)`}
        datesLabel={`${formatISODate(request.startDate)} – ${formatISODate(request.endDate)}`}
        notesLabel={request.notes || "—"}
        sem1Balance={sem1Balance}
        sem2Balance={sem2Balance}
        lessSem1Label={semester === 1 ? String(request.daysCount) : "-"}
        lessSem2Label={semester === 2 ? String(request.daysCount) : "-"}
        filedByLabel={request.requestedBy.username}
        displayStatus={wellnessLeaveDisplayStatus(request.status, request.endDate, request.confirmedTakenAt)}
        pulledOutByLabel={request.cancelledBy?.username ?? null}
        pulledOutAtLabel={request.cancelledAt ? formatISODate(request.cancelledAt) : null}
        confirmedTakenByLabel={request.confirmedTakenBy?.username ?? null}
        confirmedTakenAtLabel={request.confirmedTakenAt ? formatISODate(request.confirmedTakenAt) : null}
      />
    </div>
  );
}
