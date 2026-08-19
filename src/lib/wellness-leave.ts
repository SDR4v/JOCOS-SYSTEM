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

// No admin approval gate: a filed request takes effect immediately. What's
// worth tracking instead is whether it has already happened, is still
// coming up, or was pulled back out before it happened.
export type WellnessLeaveDisplayStatus = "UPCOMING" | "TAKEN" | "CANCELLED";

export function wellnessLeaveDisplayStatus(
  status: "ACTIVE" | "CANCELLED",
  endDate: Date,
): WellnessLeaveDisplayStatus {
  if (status === "CANCELLED") return "CANCELLED";
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return endDate < today ? "TAKEN" : "UPCOMING";
}

export function wellnessLeaveDisplayStatusLabel(status: WellnessLeaveDisplayStatus): string {
  switch (status) {
    case "UPCOMING":
      return "Upcoming";
    case "TAKEN":
      return "Taken";
    case "CANCELLED":
      return "Pulled Out";
  }
}

export function canPullOutWellnessLeave(status: "ACTIVE" | "CANCELLED", endDate: Date): boolean {
  return wellnessLeaveDisplayStatus(status, endDate) === "UPCOMING";
}
