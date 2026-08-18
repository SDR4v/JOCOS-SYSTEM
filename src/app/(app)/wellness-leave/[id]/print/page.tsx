import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatISODate } from "@/lib/period";
import { getSemester, semesterLabel } from "@/lib/wellness-leave";
import { PrintButton } from "./print-button";

export default async function WellnessLeavePrintPage({ params }: PageProps<"/wellness-leave/[id]/print">) {
  const user = await requireUser();
  const { id } = await params;

  const request = await prisma.wellnessLeaveRequest.findUnique({
    where: { id },
    include: { employee: true, requestedBy: true, approvedBy: true },
  });
  if (!request) notFound();
  if (user.role !== "ADMIN" && request.employeeId !== user.employeeId) notFound();

  const semester = getSemester(request.startDate);
  const year = request.startDate.getUTCFullYear();
  const balance = await prisma.wellnessLeaveBalance.findUnique({
    where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester } },
  });

  const usedBefore = balance ? balance.used - (request.status === "APPROVED" ? request.daysCount : 0) : null;
  const remainingAfter = balance ? balance.allotted - balance.used : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Printable Wellness Leave request form</p>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-2xl border border-black bg-white p-8 text-black print:m-0 print:max-w-none print:border-0 print:p-0">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">Wellness Leave Request Form</h1>
          <p className="text-sm">JOCOS — Contract of Service (COS) Workers</p>
        </div>

        <table className="mb-4 w-full border-collapse text-sm">
          <tbody>
            <FormRow label="Employee Name" value={request.employee.name} />
            <FormRow label="Employee No." value={request.employee.employeeNo} />
            <FormRow label="Office Assignment" value={request.employee.officeAssignment} />
            <FormRow label="Position Title" value={request.employee.positionTitle} />
          </tbody>
        </table>

        <table className="mb-4 w-full border-collapse text-sm">
          <tbody>
            <FormRow label="Semester" value={semesterLabel(semester)} />
            <FormRow label="Start Date" value={formatISODate(request.startDate)} />
            <FormRow label="End Date" value={formatISODate(request.endDate)} />
            <FormRow label="Days Requested" value={String(request.daysCount)} />
            <FormRow label="Reason / Notes" value={request.notes || "—"} />
          </tbody>
        </table>

        <table className="mb-4 w-full border-collapse text-sm">
          <tbody>
            <FormRow label="Semester Allotment" value={balance ? String(balance.allotted) : "—"} />
            <FormRow label="Used Before This Request" value={usedBefore !== null ? String(usedBefore) : "—"} />
            <FormRow
              label="Remaining After"
              value={remainingAfter !== null ? String(remainingAfter) : "—"}
            />
          </tbody>
        </table>

        <table className="mb-8 w-full border-collapse text-sm">
          <tbody>
            <FormRow label="Status" value={request.status} />
            <FormRow
              label="Requested By"
              value={`${request.requestedBy.username} on ${formatISODate(request.createdAt)}`}
            />
            {request.approvedBy && request.approvedAt && (
              <FormRow
                label={request.status === "APPROVED" ? "Approved By" : "Rejected By"}
                value={`${request.approvedBy.username} on ${formatISODate(request.approvedAt)}`}
              />
            )}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 pt-8">
          <SignatureLine label="Employee Signature" />
          <SignatureLine label="HR / Approving Officer Signature" />
        </div>

        <p className="mt-8 text-right text-xs text-gray-500">Printed {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

function FormRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-48 border border-black px-2 py-1.5 align-top font-medium">{label}</td>
      <td className="border border-black px-2 py-1.5 align-top">{value}</td>
    </tr>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="text-center text-sm">
      <div className="mb-1 h-10 border-b border-black" />
      <p>{label}</p>
      <p className="text-xs text-gray-500">Date: ______________</p>
    </div>
  );
}
