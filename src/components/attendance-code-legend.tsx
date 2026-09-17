import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ATTENDANCE_CODES } from "@/lib/attendance-codes";

// Renders straight from ATTENDANCE_CODES (the same table the DTR grid and
// payroll report use) so this legend can never drift out of sync with what
// the app actually does.
function payEffect(defaultDayCredit: number, takesLateMinutes: boolean): string {
  if (takesLateMinutes) return "Full day's pay, minus the exact minutes short";
  if (defaultDayCredit === 1) return "Full day's pay";
  if (defaultDayCredit === 0.5) return "Half day's pay";
  return "No pay for the day";
}

export function AttendanceCodeLegend() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Meaning</TableHead>
          <TableHead>Effect on pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ATTENDANCE_CODES.filter((c) => c.code !== "UNSET").map((c) => (
          <TableRow key={c.code}>
            <TableCell className="font-mono font-semibold">{c.shortLabel}</TableCell>
            <TableCell>{c.label}</TableCell>
            <TableCell className="text-muted-foreground">{payEffect(c.defaultDayCredit, c.takesLateMinutes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
