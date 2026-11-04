"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarRange } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDisplayDate } from "@/lib/period";
import { endCompressedMode, setOfficeCompressedExempt, startCompressedMode } from "./compressed-actions";

export type OfficeExemption = { office: string; total: number; exempt: number };
export type OlderSavedDay = { employeeId: string; employeeName: string; iso: string };

function dtrHref(day: OlderSavedDay): string {
  const [year, month, date] = day.iso.split("-").map(Number);
  return `/admin/dtr?employeeId=${day.employeeId}&year=${year}&month=${month}&half=${date <= 15 ? 1 : 2}`;
}

export function CompressedModeCard({
  startIso,
  endIso,
  today,
  offices,
  olderSavedDays,
}: {
  // The current or upcoming period, if there is one.
  startIso: string | null;
  endIso: string | null;
  today: string;
  offices: OfficeExemption[];
  olderSavedDays: OlderSavedDay[];
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"start" | "end" | null>(null);
  const [date, setDate] = useState(today);

  const on = !!startIso;
  const covered = offices.reduce((sum, o) => sum + o.total - o.exempt, 0);
  const exempted = offices.reduce((sum, o) => sum + o.exempt, 0);

  function open(which: "start" | "end") {
    setDate(which === "end" && endIso ? endIso : today);
    setDialog(which);
  }

  function submit() {
    startTransition(async () => {
      const result = dialog === "start" ? await startCompressedMode(date) : await endCompressedMode(date);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(dialog === "start" ? "Compressed Mode is on" : "End date saved");
      setDialog(null);
    });
  }

  function toggleOffice(office: OfficeExemption) {
    const exempt = office.exempt < office.total;
    startTransition(async () => {
      const result = await setOfficeCompressedExempt(office.office, exempt);
      if (result.error) toast.error(result.error);
      else toast.success(exempt ? `${office.office} is exempt` : `${office.office} is under Compressed Mode`);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Compressed Mode</CardTitle>
          <Badge variant={on ? "default" : "outline"}>{on ? "On" : "Off"}</Badge>
        </div>
        {on ? (
          <Button type="button" variant="outline" onClick={() => open("end")}>
            <CalendarRange />
            {endIso ? "Change end date" : "Turn off"}
          </Button>
        ) : (
          <Button type="button" onClick={() => open("start")}>
            <CalendarRange />
            Turn on Compressed Mode
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {on && startIso
            ? `In effect from ${formatDisplayDate(startIso)}${endIso ? ` through ${formatDisplayDate(endIso)}` : " until turned off"}. `
            : "When on: "}
          Monday to Thursday, start between 7:00 and 8:00 AM, 10 hours of work plus lunch, counted as 1.5 days. Fridays off.
        </p>
        <p className="text-muted-foreground">
          Covers {covered} employee{covered === 1 ? "" : "s"}, with {exempted} exempt. A schedule an office has posted
          takes priority over this. Anyone exempt with no posted schedule stays on 8-5.
        </p>

        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer font-medium">Exempt an office</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            To exempt one person, use the button beside their name on the Employees page.
          </p>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {offices.map((office) => (
              <li key={office.office} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                <span className="min-w-0">
                  {office.office}{" "}
                  <span className="text-xs text-muted-foreground">
                    {office.exempt === 0
                      ? `(${office.total} covered)`
                      : office.exempt === office.total
                        ? `(all ${office.total} exempt)`
                        : `(${office.exempt} of ${office.total} exempt)`}
                  </span>
                </span>
                <Button type="button" size="sm" variant="outline" loading={pending} onClick={() => toggleOffice(office)}>
                  {office.exempt < office.total ? "Exempt" : "Put under Compressed"}
                </Button>
              </li>
            ))}
          </ul>
        </details>

        {olderSavedDays.length > 0 && (
          <details className="rounded-md border border-amber-500/40 px-3 py-2">
            <summary className="cursor-pointer font-medium">
              {olderSavedDays.length} day{olderSavedDays.length === 1 ? "" : "s"} saved before this was turned on
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              These keep their old grade and credit until opened and saved again.
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {olderSavedDays.map((day) => (
                <li key={`${day.employeeId}-${day.iso}`}>
                  <Link href={dtrHref(day)} className="text-primary underline-offset-2 hover:underline">
                    {day.employeeName}, {formatDisplayDate(day.iso)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "start" ? "Turn on Compressed Mode" : "When does Compressed Mode end?"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="compressed-date">{dialog === "start" ? "First day" : "Last compressed day"}</Label>
              <Input id="compressed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <p>
              {dialog === "start"
                ? `${covered} employee${covered === 1 ? "" : "s"} will be notified, and days graded from then on count as 1.5 days. Days already saved don't change.`
                : "After this date, covered employees go back to 8-5. Days already saved don't change."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" loading={pending} disabled={!date} onClick={submit}>
              {dialog === "start" ? "Turn on" : "Save end date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
