import type { Shift } from "@/lib/schedule-import/shift-text";

// One table of cells, whatever file it came from — every reader in extract.ts
// produces this, so nothing downstream knows or cares about the file format.
export type Grid = { name: string; cells: string[][] };

export const BLANK_TOKEN = "__blank__";

export type LayoutKind = "matrix" | "weekly" | "list" | "summary" | "duty-roster";

export const LAYOUT_LABEL: Record<LayoutKind, string> = {
  matrix: "One row per employee, one column per date",
  weekly: "One row per employee, one column per weekday",
  list: "One line per employee and date",
  summary: "One line per employee with their days and hours",
  "duty-roster": "Dates down the side with names listed under each shift",
};

// Where a token's meaning came from — shown beside it on the review screen, so
// it's clear which readings were taken from the file and which were inferred.
export type TokenSource = "legend" | "remembered" | "read" | "default" | "you";

export type TokenReading = {
  raw: string;
  shift: Shift | null; // null blocks publishing until someone decides
  source: TokenSource;
  alternatives: Shift[];
};

export type ReviewRow = {
  key: string;
  rawName: string;
  employeeId: string | null;
  employeeName: string | null;
  match: "full" | "loose" | "linked" | "none" | "skipped";
  candidates: { id: string; name: string; officeAssignment: string }[];
  // iso date → token key. A date missing here wasn't covered by the file at
  // all, which leaves that day on the employee's usual schedule.
  cells: Record<string, string>;
};

export type ScheduleDocument = {
  layout: LayoutKind;
  sheets: string[];
  rows: ReviewRow[];
  tokens: Record<string, TokenReading>;
  warnings: string[];
};
