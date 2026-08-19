"use client";

import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { wellnessLeaveDisplayStatusLabel, type WellnessLeaveDisplayStatus } from "@/lib/wellness-leave";

const STATUS_BADGE_VARIANT: Record<WellnessLeaveDisplayStatus, "default" | "outline" | "destructive"> = {
  UPCOMING: "outline",
  TAKEN: "default",
  CANCELLED: "destructive",
};

export type WellnessLeaveRequestDetails = {
  employeeName: string;
  officeAssignment: string;
  positionTitle: string;
  semesterLabel: string;
  datesLabel: string;
  daysCount: number;
  notes: string | null;
  displayStatus: WellnessLeaveDisplayStatus;
  filedAtLabel: string;
  pulledOutByLabel?: string | null;
  pulledOutAtLabel?: string | null;
};

export function ViewWellnessLeaveRequestDialog({ request }: { request: WellnessLeaveRequestDetails }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye />
            View
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wellness Leave Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="font-medium">{request.employeeName}</p>
            <p className="text-xs text-muted-foreground">
              {request.positionTitle} &middot; {request.officeAssignment}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <DetailField label="Semester" value={request.semesterLabel} />
            <DetailField label="Days" value={String(request.daysCount)} />
            <DetailField label="Inclusive Dates" value={request.datesLabel} full />
            <DetailField label="Filed" value={request.filedAtLabel} full />
          </div>

          {request.notes && <DetailField label="Notes" value={request.notes} full />}

          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={STATUS_BADGE_VARIANT[request.displayStatus]}>
              {wellnessLeaveDisplayStatusLabel(request.displayStatus)}
            </Badge>
          </div>

          {request.pulledOutByLabel && (
            <DetailField
              label="Pulled out by"
              value={`${request.pulledOutByLabel}${request.pulledOutAtLabel ? ` · ${request.pulledOutAtLabel}` : ""}`}
              full
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
