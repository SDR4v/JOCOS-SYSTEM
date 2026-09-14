// Groups one employee's non-duplicate punches (already fetched from the DB)
// into per-day classifications, for both the review screen and the
// submit-for-approval action to share the same read on what's confident vs
// flagged.
import { resolveSchedule, type EmployeeScheduleFields } from "@/lib/dtr-time";
import { classifyDayPunches, isConfidentDay, type DayClassification } from "@/lib/biometric-match";
import { formatISODate, parseISODate } from "@/lib/period";

export type EmployeeDayReview = {
  iso: string;
  classification: DayClassification;
  confident: boolean;
};

export function reviewEmployeePunches(employee: EmployeeScheduleFields, punches: Date[]): EmployeeDayReview[] {
  const byDate = new Map<string, Date[]>();
  for (const punch of punches) {
    const iso = formatISODate(punch);
    const arr = byDate.get(iso);
    if (arr) arr.push(punch);
    else byDate.set(iso, [punch]);
  }

  const results: EmployeeDayReview[] = [];
  for (const [iso, dayPunches] of byDate) {
    dayPunches.sort((a, b) => a.getTime() - b.getTime());
    const schedule = resolveSchedule(employee, parseISODate(iso).getUTCDay());
    const classification = classifyDayPunches(dayPunches, schedule);
    results.push({ iso, classification, confident: isConfidentDay(classification) });
  }
  results.sort((a, b) => a.iso.localeCompare(b.iso));
  return results;
}

export type DayPlanAction = "apply" | "skip-existing" | "flag";
export type EmployeeDayPlan = EmployeeDayReview & { planAction: DayPlanAction };

// Decides what submitting for approval would actually do with a confident
// day — shared by the review screen (to preview it) and
// submitConfidentDaysForReview (to do it) so the two can never disagree. A
// day that already has an official AttendanceDay OR an existing
// DtrEntryRequest of any status (pending, approved, or rejected) is left
// completely alone — biometric import never overwrites an official record or
// a request already in someone's hands, it only fills in a genuinely empty
// day.
export function planEmployeeDays(days: EmployeeDayReview[], blockedIsos: Set<string>): EmployeeDayPlan[] {
  return days.map((day) => {
    if (!day.confident) return { ...day, planAction: "flag" };
    if (blockedIsos.has(day.iso)) return { ...day, planAction: "skip-existing" };
    return { ...day, planAction: "apply" };
  });
}
