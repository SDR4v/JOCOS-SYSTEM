// Core JOCOS payroll math. See the plan for the confirmed formulas:
// C:\Users\rgnac\.claude\plans\lazy-marinating-kay.md

export const WORKDAY_MINUTES = 480; // 8-hour day
export const WORKDAYS_PER_MONTH = 22;

export function getDailyRate(monthlyAmount: number): number {
  return monthlyAmount / WORKDAYS_PER_MONTH;
}

export function getPerMinuteRate(dailyRate: number): number {
  return dailyRate / WORKDAY_MINUTES;
}

export type PayrollDayInput = {
  dayCredit: number;
  lateMinutes: number;
};

export type PayrollTotals = {
  dailyRate: number;
  perMinuteRate: number;
  totalDaysRendered: number;
  undertimeMinutes: number;
  grossAmount: number;
  deduction: number;
  netAmount: number;
};

export function computePayroll(days: PayrollDayInput[], monthlyAmount: number): PayrollTotals {
  const dailyRate = getDailyRate(monthlyAmount);
  const perMinuteRate = getPerMinuteRate(dailyRate);

  const totalDaysRendered = round2(days.reduce((sum, d) => sum + d.dayCredit, 0));
  const undertimeMinutes = days.reduce((sum, d) => sum + d.lateMinutes, 0);

  const grossAmount = round2(totalDaysRendered * dailyRate);
  const deduction = round2(undertimeMinutes * perMinuteRate);
  const netAmount = round2(grossAmount - deduction);

  return { dailyRate, perMinuteRate, totalDaysRendered, undertimeMinutes, grossAmount, deduction, netAmount };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Shared between the payroll report and its print view — the print report
// omits the ₱ symbol per cell since the page's own header already makes the
// currency clear.
export function formatPeso(amount: number, withSymbol = true): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return withSymbol ? `₱${formatted}` : formatted;
}
