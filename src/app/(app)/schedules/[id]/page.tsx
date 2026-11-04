import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MONTH_NAMES, getMonthRange, formatISODate } from "@/lib/period";
import { canAccessOffice, requireSchedulePoster } from "@/lib/schedule-access";
import { activeRows, STATUS_LABEL } from "@/lib/schedule-import/review";
import { findStaleSavedDays } from "@/lib/schedule-import/stale-days";
import { LAYOUT_LABEL, type ScheduleDocument } from "@/lib/schedule-import/types";
import { ScheduleReview } from "./schedule-review";

export const maxDuration = 60;

export default async function ScheduleReviewPage({ params }: PageProps<"/schedules/[id]">) {
  const access = await requireSchedulePoster();
  const { id } = await params;

  const upload = await prisma.scheduleUpload.findUnique({
    where: { id },
    select: {
      id: true,
      office: true,
      year: true,
      month: true,
      filename: true,
      status: true,
      document: true,
      returnNote: true,
      uploadedBy: { select: { username: true } },
      publishedAt: true,
      publishedBy: { select: { username: true } },
    },
  });
  if (!upload || !canAccessOffice(access, upload.office)) notFound();

  const document = upload.document as unknown as ScheduleDocument;
  const editable =
    upload.status === "DRAFT" || (upload.status === "SUBMITTED" && access.isAdmin);

  const roster = await prisma.employee.findMany({
    where: { status: "ACTIVE", deletedAt: null, ...(access.isAdmin ? {} : { officeAssignment: upload.office }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, officeAssignment: true },
  });
  const listed = new Set(activeRows(document).map((row) => row.employeeId));
  const missingFromFile = roster
    .filter((e) => e.officeAssignment === upload.office && !listed.has(e.id))
    .map((e) => e.name);

  const staleDays =
    access.isAdmin && upload.status !== "SUPERSEDED"
      ? await findStaleSavedDays(document, upload.year, upload.month)
      : [];

  const dates = getMonthRange(upload.year, upload.month).dates.map(formatISODate);
  const monthName = `${MONTH_NAMES[upload.month - 1]} ${upload.year}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/schedules">
          <Button type="button" variant="outline" size="sm">
            <ArrowLeft />
            Back to schedules
          </Button>
        </Link>
        <a href={`/api/schedules/${upload.id}`}>
          <Button type="button" variant="outline" size="sm">
            <Download />
            Original file
          </Button>
        </a>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{upload.office}</h1>
          <Badge variant={upload.status === "PUBLISHED" ? "default" : "secondary"}>{STATUS_LABEL[upload.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {monthName} &middot; {upload.filename} &middot; uploaded by {upload.uploadedBy.username}
          {upload.publishedAt && upload.publishedBy
            ? ` · published ${upload.publishedAt.toISOString().slice(0, 10)} by ${upload.publishedBy.username}`
            : ""}
        </p>
        <p className="text-sm text-muted-foreground">Read as: {LAYOUT_LABEL[document.layout]}.</p>
      </div>

      <ScheduleReview
        id={upload.id}
        status={upload.status}
        isAdmin={access.isAdmin}
        editable={editable}
        returnNote={upload.returnNote}
        document={document}
        dates={dates}
        roster={roster}
        missingFromFile={missingFromFile}
        staleDays={staleDays}
      />
    </div>
  );
}
