// What's still in the way of a schedule going live, and how one cell should
// look — shared by the review screen (to show it) and the publish action (to
// enforce it), so the two can never disagree.
import { formatShift, type Shift } from "@/lib/schedule-import/shift-text";
import { BLANK_TOKEN, type ReviewRow, type ScheduleDocument } from "@/lib/schedule-import/types";

export function activeRows(document: ScheduleDocument): ReviewRow[] {
  return document.rows.filter((row) => row.match !== "skipped");
}

export function tokenUsage(document: ScheduleDocument): Map<string, number> {
  const usage = new Map<string, number>();
  for (const row of activeRows(document)) {
    for (const token of Object.values(row.cells)) usage.set(token, (usage.get(token) ?? 0) + 1);
  }
  return usage;
}

export type Blockers = { unmatchedNames: ReviewRow[]; unresolvedTokens: string[] };

export function findBlockers(document: ScheduleDocument): Blockers {
  const usage = tokenUsage(document);
  return {
    unmatchedNames: activeRows(document).filter((row) => !row.employeeId),
    unresolvedTokens: [...usage.keys()].filter((key) => !document.tokens[key]?.shift),
  };
}

export function isReady(blockers: Blockers, document: ScheduleDocument): boolean {
  return (
    blockers.unmatchedNames.length === 0 &&
    blockers.unresolvedTokens.length === 0 &&
    activeRows(document).length > 0
  );
}

function compactTime(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const face = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${face}:${String(minute).padStart(2, "0")}` : String(face);
}

// What fits in a narrow grid cell. The full reading is on hover.
export function cellLabel(shift: Shift | null | undefined): string {
  if (!shift) return "?";
  if (shift.kind === "off") return "OFF";
  if (shift.kind === "usual") return "•";
  const first = shift.session1 ?? shift.session2!;
  const last = shift.session2 ?? shift.session1!;
  return `${compactTime(first.start)}-${compactTime(last.end)}`;
}

export function cellTitle(tokenKey: string, rawText: string | undefined, shift: Shift | null | undefined): string {
  const written = tokenKey === BLANK_TOKEN ? "Blank in the file" : `Written as "${rawText ?? tokenKey}"`;
  return `${written}: ${formatShift(shift ?? null)}`;
}

export const STATUS_LABEL = {
  DRAFT: "Draft",
  SUBMITTED: "Waiting for HR",
  PUBLISHED: "Published",
  SUPERSEDED: "Replaced",
} as const;
