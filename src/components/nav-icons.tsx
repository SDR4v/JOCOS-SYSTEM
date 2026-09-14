// Custom line-icon set for the admin nav — see the design specimen for the
// rationale behind each mark. Same discipline throughout: 24x24 viewBox,
// 1.75 stroke, round caps/joins, no fill — matches the lucide-react icons
// used elsewhere (bell, printer, sign-out, etc.) so the header stays coherent.
import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function EmployeesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <circle cx="8" cy="10.5" r="2.25" />
      <path d="M4.75 16.5c.5-2 1.8-3 3.25-3s2.75 1 3.25 3" />
      <path d="M14.5 9h4.5" />
      <path d="M14.5 12.5h4.5" />
    </Icon>
  );
}

export function SalaryGradesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 21h18" />
      <path d="M6 21v-5" />
      <path d="M12 21v-9" />
      <path d="M18 21v-13" />
      <circle cx="18" cy="5" r="2.3" />
      <path d="M16.6 5h2.8" />
    </Icon>
  );
}

export function DtrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" strokeDasharray="1.6 2" />
      <circle cx="12" cy="15.3" r="3.4" />
      <path d="M12 13.6v1.9l1.4 1.1" />
    </Icon>
  );
}

export function DtrRequestsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v9.5" />
      <path d="M8.2 9.3 12 13l3.8-3.7" />
      <path d="M3.5 13v5.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V13" />
    </Icon>
  );
}

export function PayrollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 3h12v16.2l-1.7-1.1-1.7 1.1-1.6-1.1-1.7 1.1-1.6-1.1-1.7 1.1V3z" />
      <path d="M9 8h6" />
      <path d="M9 11.2h4" />
    </Icon>
  );
}

export function WellnessLeaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M19.5 4.5c-9 0-14.5 5.5-14.5 13.5 8 0 15-5 15-13.5-.2 0-.3 0-.5 0z" />
      <path d="M5 18c3.5-2 8-6.5 10-11" />
    </Icon>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M9 13.5v6.2" />
      <path d="M9 13.5l3.2 1.6-3.2 1.6" />
    </Icon>
  );
}

export function BiometricsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 4.2a6.8 6.8 0 0 1 6.8 6.8v3.4" />
      <path d="M12 4.2a6.8 6.8 0 0 0-6.8 6.8v3" />
      <path d="M8.6 21c-1.2-1.1-2-2.9-2-4.8V11a5.4 5.4 0 0 1 10.8 0v4" />
      <path d="M12 21c-1.1-.9-1.7-2.3-1.7-3.8V11" />
      <path d="M15.1 17V11" />
    </Icon>
  );
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5A8.5 8.5 0 1 1 4.3 15.7" />
      <path d="M3 4.2v5.3h5.3" />
      <path d="M12 8.2v4l3 1.9" />
    </Icon>
  );
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 2.8h9l4 4v13.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1z" />
      <path d="M15 2.8v4h4" />
      <path d="M8 12.3l1.7 1.7 3-3.4" />
      <path d="M8 17h6" />
    </Icon>
  );
}
