"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/period";
import { uploadSchedule } from "./actions";

export function UploadScheduleForm({
  offices,
  lockedOffice,
  defaultYear,
  defaultMonth,
}: {
  offices: string[];
  // A designated employee can only ever post for their own office.
  lockedOffice: string | null;
  defaultYear: number;
  defaultMonth: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [office, setOffice] = useState(lockedOffice ?? "");
  const [year, setYear] = useState(String(defaultYear));
  const [month, setMonth] = useState(String(defaultMonth));
  const [problem, setProblem] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    formData.set("office", office);
    formData.set("year", year);
    formData.set("month", month);
    setProblem(null);
    startTransition(async () => {
      const result = await uploadSchedule(formData);
      if (result.error) {
        setProblem(result.error);
        return;
      }
      toast.success("File read — check it below");
      router.push(`/schedules/${result.id}`);
    });
  }

  const templateHref = `/api/schedules/template?office=${encodeURIComponent(office)}&year=${year}&month=${month}`;

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Office</Label>
          {lockedOffice ? (
            <Input value={lockedOffice} disabled />
          ) : (
            <Select value={office} onValueChange={(value) => setOffice(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an office" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select value={month} onValueChange={(value) => setMonth(value ?? month)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(value: string) => MONTH_NAMES[Number(value) - 1]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-year">Year</Label>
          <Input
            id="schedule-year"
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-file">Schedule file</Label>
          <Input id="schedule-file" name="file" type="file" accept=".xlsx,.xls,.ods,.csv,.docx,.pdf" required />
        </div>
      </div>

      {problem && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={pending} disabled={!office}>
          <UploadCloud />
          {pending ? "Reading file..." : "Upload and read"}
        </Button>
        {office ? (
          <a href={templateHref}>
            <Button type="button" variant="outline">
              <Download />
              Get a blank template
            </Button>
          </a>
        ) : (
          <Button type="button" variant="outline" disabled title="Choose an office first">
            <Download />
            Get a blank template
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Upload the schedule the way your office already makes it: Excel, Word, CSV, or a PDF exported from one of those.
        Photos and scanned copies can&apos;t be read. For those, use the blank template.
      </p>
    </form>
  );
}
