import Link from "next/link";
import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MONTH_NAMES } from "@/lib/period";
import { requireSchedulePoster } from "@/lib/schedule-access";
import { STATUS_LABEL } from "@/lib/schedule-import/review";
import { UploadScheduleForm } from "./upload-form";

export const maxDuration = 60;

const STATUS_VARIANT = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  PUBLISHED: "default",
  SUPERSEDED: "outline",
} as const;

export default async function SchedulesPage() {
  const access = await requireSchedulePoster();

  // Schedules get prepared ahead, so past mid-month the next month is the likely one.
  const now = new Date();
  const target = now.getDate() > 15 ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : now;
  const defaultYear = target.getFullYear();
  const defaultMonth = target.getMonth() + 1;

  const [uploads, officeRows] = await Promise.all([
    prisma.scheduleUpload.findMany({
      where: access.isAdmin ? {} : { office: access.office! },
      orderBy: [{ year: "desc" }, { month: "desc" }, { uploadedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        office: true,
        year: true,
        month: true,
        filename: true,
        status: true,
        uploadedAt: true,
        uploadedBy: { select: { username: true } },
      },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      distinct: ["officeAssignment"],
      orderBy: { officeAssignment: "asc" },
      select: { officeAssignment: true },
    }),
  ]);
  const offices = officeRows.map((o) => o.officeAssignment);

  const postedThisMonth = new Set(
    uploads
      .filter((u) => u.status === "PUBLISHED" && u.year === defaultYear && u.month === defaultMonth)
      .map((u) => u.office),
  );
  const notPosted = offices.filter((office) => !postedThisMonth.has(office));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{access.isAdmin ? "Monthly Schedules" : "Office Schedule"}</h1>
        <p className="text-sm text-muted-foreground">
          {access.isAdmin
            ? "Each office's schedule for the month. Once published, it sets every listed employee's hours on the DTR."
            : `Post ${access.office}'s schedule here. HR publishes it once it's been checked.`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadScheduleForm
            offices={offices}
            lockedOffice={access.office}
            defaultYear={defaultYear}
            defaultMonth={defaultMonth}
          />
        </CardContent>
      </Card>

      {access.isAdmin && notPosted.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">
            {notPosted.length} of {offices.length} offices have no published schedule for {MONTH_NAMES[defaultMonth - 1]}{" "}
            {defaultYear}
          </summary>
          <p className="mt-2 text-muted-foreground">
            Their employees stay on their usual hours until one is published: {notPosted.join(", ")}.
          </p>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Office</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => (
                    <TableRow key={upload.id} className={upload.status === "SUPERSEDED" ? "opacity-60" : undefined}>
                      <TableCell className="max-w-[260px] font-medium whitespace-normal">{upload.office}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {MONTH_NAMES[upload.month - 1]} {upload.year}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={upload.filename}>
                        {upload.filename}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {upload.uploadedAt.toISOString().slice(0, 10)} &middot; {upload.uploadedBy.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[upload.status]}>{STATUS_LABEL[upload.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/schedules/${upload.id}`}>
                          <Button type="button" variant="outline" size="sm">
                            <ListChecks />
                            {upload.status === "DRAFT" || upload.status === "SUBMITTED" ? "Review" : "View"}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
