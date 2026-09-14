"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/download-pdf-button";

export function PrintControls({
  defaultDate,
  filename,
  children,
}: {
  defaultDate: string;
  filename: string;
  children: ReactNode;
}) {
  const [date, setDate] = useState(defaultDate);
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prepared by
          <input
            type="text"
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            placeholder="Name"
            className="rounded-md border px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Reviewed by
          <input
            type="text"
            value={reviewedBy}
            onChange={(e) => setReviewedBy(e.target.value)}
            placeholder="Name"
            className="rounded-md border px-2 py-1 text-sm"
          />
        </label>
        <DownloadPdfButton targetId="payroll-print-content" filename={filename} orientation="landscape" />
        <Button type="button" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div id="payroll-print-content">
        {children}

        <div className="mt-4 flex gap-10 text-[10px] text-black">
          <p>
            <span className="font-semibold">DATE:</span> {date}
          </p>
          <div>
            <p className="font-semibold">PREPARED BY:</p>
            <p className="mt-3 border-t border-black pt-0.5">
              {preparedBy || " "}
            </p>
          </div>
          <div>
            <p className="font-semibold">REVIEWED BY:</p>
            <p className="mt-3 border-t border-black pt-0.5">
              {reviewedBy || " "}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
