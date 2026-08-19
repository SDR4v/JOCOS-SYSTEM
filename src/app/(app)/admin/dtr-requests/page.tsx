import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayCodeForDay } from "@/lib/attendance-codes";
import { formatISODate } from "@/lib/period";
import { ApproveRejectButtons } from "./request-actions";
import { HistoryTable } from "./history-table";

export default async function DtrRequestsPage() {
  await requireAdmin();

  const requests = await prisma.dtrEntryRequest.findMany({
    include: { employee: true },
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
        <h2 className="text-sm font-semibold text-muted-foreground">
          Pending {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending DTR entries to review.</p>
        ) : (
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Proposed Code</TableHead>
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
                    <TableCell className="text-sm">{displayCodeForDay(request.code, request.lateMinutes)}</TableCell>
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
              code: r.code,
              lateMinutes: r.lateMinutes,
              notes: r.notes,
              status: r.status as "APPROVED" | "REJECTED",
              employee: { name: r.employee.name },
            }))}
          />
        </div>
      )}
    </div>
  );
}
