import { Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatISODate } from "@/lib/period";
import { formatTimeHHMM, previewRequestCode, resolveSchedule, type ManualOverrideCode } from "@/lib/dtr-time";
import { ApproveRejectButtons } from "./request-actions";
import { HistoryTable } from "./history-table";

export default async function DtrRequestsPage() {
  await requireAdmin();

  const requests = await prisma.dtrEntryRequest.findMany({
    include: { employee: { include: { daySchedules: true } } },
    orderBy: { submittedAt: "desc" },
  });

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const resolvedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">DTR Requests</h1>
        <p className="text-sm text-muted-foreground">
          Attendance entries COS workers submitted themselves — approving one writes it into their DTR.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          Pending
          {pendingRequests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold/15 px-1.5 text-xs font-semibold text-brand-gold">
              {pendingRequests.length}
            </span>
          )}
        </h2>
        {pendingRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-card py-10 text-center shadow-sm">
            <Inbox className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No pending DTR entries to review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>AM</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.employee.name}</TableCell>
                    <TableCell className="text-sm">{formatISODate(request.date)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {request.overrideCode
                        ? "—"
                        : `${request.amArrival ? formatTimeHHMM(request.amArrival) : "—"}–${request.amDeparture ? formatTimeHHMM(request.amDeparture) : "—"}`}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {request.overrideCode
                        ? "—"
                        : `${request.pmArrival ? formatTimeHHMM(request.pmArrival) : "—"}–${request.pmDeparture ? formatTimeHHMM(request.pmDeparture) : "—"}`}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {previewRequestCode(
                        { ...request, overrideCode: request.overrideCode as ManualOverrideCode | null },
                        resolveSchedule(request.employee, request.date.getUTCDay()),
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{request.notes ?? ""}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatISODate(request.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <ApproveRejectButtons id={request.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {resolvedRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">History</h2>
          <HistoryTable
            requests={resolvedRequests.map((r) => ({
              id: r.id,
              date: r.date,
              amArrival: r.amArrival,
              amDeparture: r.amDeparture,
              pmArrival: r.pmArrival,
              pmDeparture: r.pmDeparture,
              overrideCode: r.overrideCode as ManualOverrideCode | null,
              notes: r.notes,
              status: r.status as "APPROVED" | "REJECTED",
              employee: { name: r.employee.name },
              schedule: resolveSchedule(r.employee, r.date.getUTCDay()),
            }))}
          />
        </div>
      )}
    </div>
  );
}
