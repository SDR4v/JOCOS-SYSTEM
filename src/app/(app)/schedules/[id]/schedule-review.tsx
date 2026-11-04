"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, RotateCcw, Send, Trash2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeCombobox, type EmployeeOption } from "@/components/employee-combobox";
import { formatDisplayDate } from "@/lib/period";
import { cn } from "@/lib/utils";
import { activeRows, cellLabel, cellTitle, findBlockers, isReady, tokenUsage } from "@/lib/schedule-import/review";
import { formatShift } from "@/lib/schedule-import/shift-text";
import { BLANK_TOKEN, type ReviewRow, type ScheduleDocument, type TokenSource } from "@/lib/schedule-import/types";
import type { StaleDay } from "@/lib/schedule-import/stale-days";
import {
  deleteSchedule,
  editCell,
  linkRow,
  publishSchedule,
  reopenSchedule,
  returnSchedule,
  setRowSkipped,
  setTokenMeaning,
  submitSchedule,
  type ActionResult,
} from "../actions";

const SOURCE_LABEL: Record<TokenSource, string> = {
  legend: "From the file's legend",
  remembered: "Used before by this office",
  read: "Read directly",
  default: "Assumed",
  you: "Set during review",
};

function dtrHref(day: StaleDay): string {
  const [year, month, date] = day.iso.split("-").map(Number);
  return `/admin/dtr?employeeId=${day.employeeId}&year=${year}&month=${month}&half=${date <= 15 ? 1 : 2}`;
}

export function ScheduleReview({
  id,
  status,
  isAdmin,
  editable,
  returnNote,
  document,
  dates,
  roster,
  missingFromFile,
  staleDays,
}: {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "PUBLISHED" | "SUPERSEDED";
  isAdmin: boolean;
  editable: boolean;
  returnNote: string | null;
  document: ScheduleDocument;
  dates: string[];
  roster: EmployeeOption[];
  missingFromFile: string[];
  staleDays: StaleDay[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingCell, setEditingCell] = useState<{ row: ReviewRow; iso: string; text: string } | null>(null);
  const [editingToken, setEditingToken] = useState<{ key: string; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "delete" | "return" | null>(null);
  const [note, setNote] = useState("");

  function run(action: () => Promise<ActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      after?.();
    });
  }

  const blockers = findBlockers(document);
  const ready = isReady(blockers, document);
  const usage = tokenUsage(document);
  const rows = activeRows(document);
  const skipped = document.rows.filter((row) => row.match === "skipped");
  const looseRows = rows.filter((row) => row.match === "loose");
  const dayCount = rows.reduce((sum, row) => sum + Object.keys(row.cells).length, 0);

  // Sorted so what needs a decision comes first, then what's most used.
  const tokenEntries = [...usage.entries()]
    .map(([key, count]) => ({ key, count, token: document.tokens[key] }))
    .sort((a, b) => Number(!!a.token.shift) - Number(!!b.token.shift) || b.count - a.count);
  const legendKeys = Object.keys(document.tokens).filter((key) => key !== BLANK_TOKEN);

  return (
    <div className="space-y-4">
      {returnNote && status === "DRAFT" && (
        <Notice tone="warn">
          <strong>HR returned this:</strong> {returnNote}
        </Notice>
      )}
      {document.warnings.map((warning) => (
        <Notice key={warning} tone="warn">
          {warning}
        </Notice>
      ))}

      {blockers.unmatchedNames.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">
              Who are these? ({blockers.unmatchedNames.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These names didn&apos;t match anyone on the roster with certainty. Pick the right employee, or leave them out
              if they aren&apos;t on the roster.
            </p>
            {blockers.unmatchedNames.map((row) => (
              <NameRow
                key={row.key}
                row={row}
                roster={roster}
                editable={editable}
                pending={pending}
                onLink={(employeeId) => run(() => linkRow(id, row.key, employeeId), "Linked")}
                onSkip={() => run(() => setRowSkipped(id, row.key, true), "Left out")}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className={blockers.unresolvedTokens.length > 0 ? "border-destructive/40" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">What each entry means</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Fix an entry once here and it&apos;s fixed everywhere it appears. Your answers are remembered for this office.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>In the file</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Read as</TableHead>
                  <TableHead>Where from</TableHead>
                  {editable && <TableHead className="text-right">Change</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokenEntries.map(({ key, count, token }) => (
                  <TableRow key={key} className={!token.shift ? "bg-destructive/5" : undefined}>
                    <TableCell className="max-w-[240px] font-medium whitespace-normal">{token.raw}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{count}</TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      {token.shift ? (
                        formatShift(token.shift)
                      ) : (
                        <span className="font-medium text-destructive">
                          {token.alternatives.length > 0 ? "Could be either — choose one" : "Not sure what this means"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {token.shift ? SOURCE_LABEL[token.source] : "—"}
                    </TableCell>
                    {editable && (
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          {token.alternatives.map((alternative) => (
                            <Button
                              key={formatShift(alternative)}
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={pending}
                              onClick={() =>
                                run(() => setTokenMeaning(id, key, formatShift(alternative)), "Saved")
                              }
                            >
                              {formatShift(alternative)}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant={token.shift ? "ghost" : "default"}
                            onClick={() => setEditingToken({ key, text: "" })}
                          >
                            {token.shift ? "Change" : "Set hours"}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {looseRows.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">
            {looseRows.length} matched by surname only — worth a quick look
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {looseRows.map((row) => (
              <li key={row.key}>
                &quot;{row.rawName}&quot; was matched to {row.employeeName}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            The month, as read ({rows.length} employee{rows.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {editable ? "Click a day to correct it. Hover to see exactly what it means. " : "Hover a day to see exactly what it means. "}
            A dash means the file doesn&apos;t cover that date, so it stays on the employee&apos;s usual schedule.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-[1] min-w-52 bg-muted px-2 py-1.5 text-left font-medium">Employee</th>
                  {dates.map((iso) => {
                    const date = new Date(`${iso}T00:00:00Z`);
                    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                    return (
                      <th key={iso} className={cn("min-w-11 px-0.5 py-1 text-center font-medium", weekend && "text-muted-foreground")}>
                        <div>{date.getUTCDate()}</div>
                        <div className="text-[0.6rem] font-normal">
                          {date.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" }).slice(0, 2)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td
                      className={cn(
                        "sticky left-0 z-[1] bg-card px-2 py-1 font-medium whitespace-nowrap",
                        !row.employeeId && "text-destructive",
                      )}
                      title={`Written in the file as "${row.rawName}"`}
                    >
                      {row.employeeName ?? row.rawName}
                    </td>
                    {dates.map((iso) => {
                      const tokenKey = row.cells[iso];
                      if (tokenKey === undefined && !editable) {
                        return (
                          <td key={iso} className="text-center text-muted-foreground/50" title="Not in the file">
                            –
                          </td>
                        );
                      }
                      const token = tokenKey ? document.tokens[tokenKey] : undefined;
                      const off = token?.shift?.kind === "off";
                      const unknown = tokenKey !== undefined && !token?.shift;
                      const label = tokenKey === undefined ? "–" : cellLabel(token?.shift);
                      const title = tokenKey === undefined ? "Not in the file" : cellTitle(tokenKey, token?.raw, token?.shift);
                      const className = cn(
                        "block w-full px-0.5 py-1 text-center whitespace-nowrap",
                        off && "text-muted-foreground",
                        tokenKey === undefined && "text-muted-foreground/50",
                        unknown && "bg-destructive/10 font-semibold text-destructive",
                        token?.shift?.kind === "hours" && "font-medium",
                      );
                      return (
                        <td key={iso} className="border-l p-0">
                          {editable ? (
                            <button
                              type="button"
                              title={title}
                              className={cn(className, "hover:bg-accent")}
                              onClick={() =>
                                setEditingCell({
                                  row,
                                  iso,
                                  text: tokenKey && tokenKey !== BLANK_TOKEN ? (token?.raw ?? "") : "",
                                })
                              }
                            >
                              {label}
                            </button>
                          ) : (
                            <span title={title} className={className}>
                              {label}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {missingFromFile.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">
            {missingFromFile.length} employee{missingFromFile.length === 1 ? " is" : "s are"} in this office but not in the file
          </summary>
          <p className="mt-2 text-muted-foreground">
            They stay on their usual schedule: {missingFromFile.join("; ")}.
          </p>
        </details>
      )}

      {skipped.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">{skipped.length} left out of this schedule</summary>
          <ul className="mt-2 space-y-1">
            {skipped.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                {row.rawName}
                {editable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => setRowSkipped(id, row.key, false), "Put back")}
                  >
                    Put back
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {staleDays.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              {staleDays.length} saved day{staleDays.length === 1 ? "" : "s"} would grade differently under this schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Publishing doesn&apos;t change attendance that&apos;s already saved. Open each one and save it again to re-grade it.
            </p>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {staleDays.map((day) => (
                <li key={`${day.employeeId}-${day.iso}`}>
                  <Link href={dtrHref(day)} className="text-primary underline-offset-2 hover:underline">
                    {day.employeeName}, {formatDisplayDate(day.iso)}
                  </Link>{" "}
                  <span className="text-muted-foreground">— {day.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
        <p className="text-sm">
          {status === "PUBLISHED" ? (
            "This schedule is in effect."
          ) : status === "SUPERSEDED" ? (
            "A newer file replaced this one."
          ) : status === "SUBMITTED" && !isAdmin ? (
            "Sent to HR. You'll be notified when it's published or returned."
          ) : ready ? (
            `Ready: ${rows.length} employee(s), ${dayCount} day(s).`
          ) : (
            <span className="text-destructive">
              {[
                blockers.unmatchedNames.length > 0 && `${blockers.unmatchedNames.length} name(s) to match`,
                blockers.unresolvedTokens.length > 0 && `${blockers.unresolvedTokens.length} entr${blockers.unresolvedTokens.length === 1 ? "y" : "ies"} to explain`,
              ]
                .filter(Boolean)
                .join(" and ")}{" "}
              before this can go further.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(isAdmin || status === "DRAFT") && (
            <Button type="button" variant="outline" onClick={() => setConfirm("delete")}>
              <Trash2 />
              Delete
            </Button>
          )}
          {isAdmin && status === "SUBMITTED" && (
            <Button type="button" variant="outline" onClick={() => setConfirm("return")}>
              <RotateCcw />
              Return to office
            </Button>
          )}
          {isAdmin && status === "PUBLISHED" && (
            <Button
              type="button"
              variant="outline"
              loading={pending}
              onClick={() => run(() => reopenSchedule(id), "Reopened — it stays in effect until you publish again")}
            >
              Reopen to correct
            </Button>
          )}
          {!isAdmin && status === "DRAFT" && (
            <Button
              type="button"
              disabled={!ready}
              loading={pending}
              onClick={() => run(() => submitSchedule(id), "Sent to HR")}
            >
              <Send />
              Send to HR
            </Button>
          )}
          {isAdmin && (status === "DRAFT" || status === "SUBMITTED") && (
            <Button type="button" disabled={!ready} onClick={() => setConfirm("publish")}>
              <Check />
              Publish
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCell?.row.employeeName ?? editingCell?.row.rawName},{" "}
              {editingCell ? formatDisplayDate(editingCell.iso) : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editingCell) return;
              const { row, iso, text } = editingCell;
              run(() => editCell(id, row.key, iso, text), "Updated", () => setEditingCell(null));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="cell-text">Hours or code</Label>
              <Input
                id="cell-text"
                autoFocus
                value={editingCell?.text ?? ""}
                onChange={(e) => setEditingCell((c) => (c ? { ...c, text: e.target.value } : c))}
                placeholder="8AM-5PM, 10PM-6AM, OFF"
              />
              {legendKeys.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {legendKeys.slice(0, 12).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded border px-1.5 py-0.5 text-xs hover:bg-accent"
                      title={formatShift(document.tokens[key].shift)}
                      onClick={() =>
                        setEditingCell((c) => (c ? { ...c, text: document.tokens[key].raw } : c))
                      }
                    >
                      {document.tokens[key].raw}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingToken} onOpenChange={(open) => !open && setEditingToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              What does &quot;{editingToken ? document.tokens[editingToken.key]?.raw : ""}&quot; mean?
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editingToken) return;
              const { key, text } = editingToken;
              run(() => setTokenMeaning(id, key, text), "Saved", () => setEditingToken(null));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="token-text">Hours</Label>
              <Input
                id="token-text"
                autoFocus
                value={editingToken?.text ?? ""}
                onChange={(e) => setEditingToken((t) => (t ? { ...t, text: e.target.value } : t))}
                placeholder="8AM-5PM, or 8AM-12PM, 1PM-5PM"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                loading={pending}
                onClick={() => {
                  if (!editingToken) return;
                  const { key } = editingToken;
                  run(() => setTokenMeaning(id, key, "usual"), "Saved", () => setEditingToken(null));
                }}
              >
                Their usual schedule
              </Button>
              <Button
                type="button"
                variant="outline"
                loading={pending}
                onClick={() => {
                  if (!editingToken) return;
                  const { key } = editingToken;
                  run(() => setTokenMeaning(id, key, "off"), "Saved", () => setEditingToken(null));
                }}
              >
                Day off
              </Button>
              <Button type="submit" loading={pending} disabled={!editingToken?.text.trim()}>
                Save hours
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "publish"} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this schedule?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              {rows.length} employee{rows.length === 1 ? "" : "s"} will be graded against these hours from now on, and
              will be notified. Anything already set for them this month is replaced.
            </p>
            {staleDays.length > 0 && (
              <p className="text-muted-foreground">
                {staleDays.length} already-saved day{staleDays.length === 1 ? "" : "s"} won&apos;t change until re-saved — they
                stay listed on this page.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              loading={pending}
              onClick={() => run(() => publishSchedule(id), "Schedule published", () => setConfirm(null))}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "return"} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return to the office</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="return-note">What needs fixing?</Label>
            <Input id="return-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              loading={pending}
              onClick={() => run(() => returnSchedule(id, note), "Returned", () => setConfirm(null))}
            >
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "delete"} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            {status === "PUBLISHED"
              ? "It's in effect now. Deleting it puts these employees back on their usual schedule for this month. Days already saved keep their grade."
              : "The uploaded file and any corrections made to it will be gone."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={() => run(() => deleteSchedule(id), "Deleted", () => router.push("/schedules"))}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        tone === "warn" && "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </p>
  );
}

function NameRow({
  row,
  roster,
  editable,
  pending,
  onLink,
  onSkip,
}: {
  row: ReviewRow;
  roster: EmployeeOption[];
  editable: boolean;
  pending: boolean;
  onLink: (employeeId: string) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState("");
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">&quot;{row.rawName}&quot;</span>
        {row.candidates.length === 0 && <Badge variant="outline">No similar name on the roster</Badge>}
      </div>
      {editable && (
        <>
          {row.candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Maybe:</span>
              {row.candidates.map((candidate) => (
                <Button
                  key={candidate.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={pending}
                  title={candidate.officeAssignment}
                  onClick={() => onLink(candidate.id)}
                >
                  {candidate.name}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <EmployeeCombobox
              employees={roster}
              value={selected}
              onValueChange={setSelected}
              className="w-full sm:w-96"
              placeholder="Search the roster..."
            />
            <Button type="button" size="sm" disabled={!selected} loading={pending} onClick={() => onLink(selected)}>
              Link
            </Button>
            <Button type="button" size="sm" variant="ghost" loading={pending} onClick={onSkip}>
              <UserX />
              Not on the roster — leave out
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
