// Wellness Leave rules confirmed by HR (see plan: C:\Users\rgnac\.claude\plans\lazy-marinating-kay.md)
// 5 days/year total, split into two non-fungible semester buckets: 3 for
// Jan-Jun, 2 for Jul-Dec. A single request may cover at most 3 consecutive days.

export type Semester = 1 | 2;

export const SEMESTER_ALLOTMENT: Record<Semester, number> = { 1: 3, 2: 2 };
export const MAX_CONSECUTIVE_DAYS = 3;

export function getSemester(date: Date): Semester {
  return date.getUTCMonth() < 6 ? 1 : 2;
}

export function semesterLabel(semester: Semester): string {
  return semester === 1 ? "1st Sem (Jan–Jun)" : "2nd Sem (Jul–Dec)";
}
