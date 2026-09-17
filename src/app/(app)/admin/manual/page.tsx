import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceCodeLegend } from "@/components/attendance-code-legend";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Employees" },
  { id: "salary-grades", label: "Salary Grades" },
  { id: "biometrics", label: "Biometrics" },
  { id: "calendar", label: "Calendar / Holidays" },
  { id: "dtr", label: "DTR" },
  { id: "codes", label: "Attendance codes" },
  { id: "dtr-requests", label: "DTR Requests" },
  { id: "monitoring", label: "Monitoring" },
  { id: "wellness-leave", label: "Wellness Leave" },
  { id: "payroll", label: "Daily Rate Computation" },
  { id: "history", label: "History" },
  { id: "activity", label: "Activity" },
];

export default async function AdminManualPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Manual</h1>
        <p className="text-sm text-muted-foreground">
          A guide to running JOCOS as an admin/HR user — the roster, biometrics, the DTR workflow, and payroll.
          Looking for the employee-facing guide instead? See the{" "}
          <Link href="/manual" className="underline underline-offset-2">
            Manual
          </Link>{" "}
          every COS/Casual staff member sees.
        </p>
      </div>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {s.label}
          </a>
        ))}
      </nav>

      <Card id="overview" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Every create/update/delete you make anywhere in the admin side is written to the{" "}
            <Link href="/admin/activity" className="underline underline-offset-2">
              Activity
            </Link>{" "}
            log automatically — so if you're ever unsure whether a change actually went through, that's the
            place to check. The rough order most admin work happens in during a pay period is:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Keep the roster (<strong>Employees</strong>) and rates (<strong>Salary Grades</strong>) up to date.</li>
            <li>Mark any holidays or suspended-work days on the <strong>Calendar</strong> as they come up.</li>
            <li>Upload and process the fingerprint scanner export in <strong>Biometrics</strong>.</li>
            <li>Fill in/correct times on <strong>DTR</strong>, and approve what employees submitted themselves in <strong>DTR Requests</strong>.</li>
            <li>Check <strong>Monitoring</strong> for anyone with an incomplete DTR before you close the period.</li>
            <li>Run <strong>Daily Rate Computation</strong> to generate and print the payroll report.</li>
          </ol>
        </CardContent>
      </Card>

      <Card id="employees" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The master roster of COS/Casual workers, under two tabs: <strong>Employees</strong> and{" "}
            <strong>Removed</strong>. Use the search box to filter by name, employee no., office, or position.
          </p>
          <p>
            <strong>Add Employee</strong> asks for Office Assignment, Employee No., Salary Grade (1–33), Full
            Name, and Position Title — new employees start Active on a Standard schedule. <strong>Edit</strong>{" "}
            changes any of those same fields later.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Deactivate / Activate</strong> — toggles whether this employee is included in Payroll and
              Monitoring. Doesn't touch the roster or their history.
            </li>
            <li>
              <strong>Remove</strong> (trash icon) — a soft delete: hides them into the Removed tab and forces
              them Inactive, but keeps every DTR/payroll/leave record intact. <strong>Restore</strong> from the
              Removed tab brings them back — but leaves them Inactive, so remember to Activate them again too.
            </li>
            <li>
              <strong>Create Login</strong> / <strong>Reset Password</strong> — this is how an employee gets
              access to their own portal. There's no way to view an existing password (only stored as a hash),
              so if someone forgets theirs, resetting it to a new one is the only fix.
            </li>
          </ul>
          <p>
            <strong>Schedule</strong> opens each employee's work-hours dialog — Standard office hours (8–12,
            1–5, Mon–Fri), Custom (one set of AM/PM hours every day, either half independently toggleable), or
            Per-Day (a different schedule for each day of the week, useful for a shortened Saturday or marking a
            rest day). This drives what counts as late/undertime on their DTR, and which days Monitoring expects
            them to have an entry for. A single continuous session (e.g. a straight night shift) is always
            entered under the "AM" fields regardless of what time it actually falls at — the DTR grid follows the
            same convention.
          </p>
        </CardContent>
      </Card>

      <Card id="salary-grades" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Salary Grades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Maintains the peso Monthly Amount per Salary Grade, <strong>per year</strong> — Daily Rate (÷22) and
            Per-Minute Rate (÷480) are derived and shown automatically, you only ever type the Monthly Amount.
          </p>
          <p>
            <strong>Add Rate</strong> takes Year + SG + Monthly Amount; saving over an existing Year+SG pair
            overwrites it rather than erroring, so Edit is really the same form with SG locked.
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Rates don't roll over automatically — set them up for each new year. An employee whose SG has no rate
            for the year being viewed shows a <strong>"No rate for {"{year}"}"</strong> badge on Payroll and
            computes ₱0 rather than erroring, so that badge is your cue to come back here first.
          </p>
        </CardContent>
      </Card>

      <Card id="biometrics" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Biometrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Upload the fingerprint scanner's exported PDF, then click <strong>Process</strong> to parse it into
            individual punches and try to match each scanned name to an employee. A large export (hundreds of
            pages) can take a little while to process — that's expected.
          </p>
          <p>
            On the review screen, punches that couldn't be auto-matched show up under unmatched names — link each
            one to the right employee (or mark it "not an employee" if it's someone from another office sharing
            the same machine). Once you're happy with the matches, mark the upload <strong>Reviewed</strong> — that's
            what makes its confident days show up as pre-filled suggestions on employees' own My DTR page. It
            doesn't submit or approve anything by itself; each employee still reviews and submits their own days.
          </p>
        </CardContent>
      </Card>

      <Card id="calendar" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Calendar / Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Click any day to add a <strong>Holiday</strong> or mark it <strong>Suspended Work</strong>. Both mean
            no work/no pay for every active employee that day — DTR and Daily Rate Computation update
            automatically the moment you save it. Use <strong>Add standard holidays</strong> at the top to fill
            in the well-known recurring Philippine holidays for a year in one click (it skips any date you've
            already set something for).
          </p>
        </CardContent>
      </Card>

      <Card id="dtr" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>DTR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            The same grid employees use for themselves, but here you can enter or correct time for anyone,
            directly, with nothing needing separate approval — saving here writes straight to the official
            record. Pick an employee and a half-month period, type times or use the Override dropdown (Rest Day,
            Work Suspended, Holiday, Absent, Unset) same as employees do, and Save.
          </p>
          <p className="text-muted-foreground">
            The Code and hours columns are a live preview of what each day will grade to — see the legend below
            for what each one means and how it affects pay.
          </p>
        </CardContent>
      </Card>

      <Card id="codes" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Attendance codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <AttendanceCodeLegend />
          <p className="text-muted-foreground">
            U and T are only used for a genuine half-day (present for exactly one of the two sessions) — ordinary
            partial lateness within a session (arrived a bit late, left a bit early) shows as the exact number of
            minutes short instead, deducted at the per-minute rate.
          </p>
        </CardContent>
      </Card>

      <Card id="dtr-requests" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>DTR Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            The queue for entries employees submitted themselves through their own My DTR page. Requests are
            grouped per employee — <strong>Approve all</strong> / <strong>Reject all</strong> on a group header,
            or approve/reject individual days after expanding it. Approving is what actually writes the times
            into the official record; rejecting just sends it back (the employee can edit and resubmit).
          </p>
          <p>
            Made a mistake? Find it under the <strong>History</strong> tab and click <strong>Revert</strong> on
            an approved entry — it undoes the write and flips the request to Rejected so the employee can fix and
            resubmit it themselves, as long as nobody has since hand-edited that day directly on the DTR grid.
          </p>
        </CardContent>
      </Card>

      <Card id="monitoring" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Your pre-payroll checklist for a period — pick a Month/Year/Half and it lists every active employee
            with an incomplete DTR, with a badge for each missing day showing why: no punch data at all, partial
            punches that need a manual look, or clean biometric data that's ready but hasn't been saved yet. Click{" "}
            <strong>Open DTR</strong> to jump straight into fixing it. It also surfaces scanned names biometrics
            couldn't match yet, with a direct link to go link them.
          </p>
        </CardContent>
      </Card>

      <Card id="wellness-leave" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Wellness Leave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Employees file their own requests and it takes effect immediately — there's no approval queue here.
            Your role is tracking: the <strong>Requests</strong> tab lets you view any request, print it, mark it{" "}
            <strong>Taken</strong> early if you're holding a paper copy, or delete a mistaken filing (only while
            it's still Upcoming — an already-taken or past-dated request can't be deleted, to avoid corrupting
            the balance).
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Before requests can be filed for a new year, run <strong>Initialize {"{year}"}</strong> on the{" "}
            <strong>Balances</strong> tab — it grants every active employee their 2-day/3-day semester allotments
            for that year. Safe to click again later; it won't touch balances that already exist.
          </p>
        </CardContent>
      </Card>

      <Card id="payroll" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Daily Rate Computation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            The payroll summary — pick Month/Year and 1st half / 2nd half / Combined, and it computes Gross,
            Deduction, and Net per active employee, grouped by office, with a grand total at the bottom.
          </p>
          <p>
            <strong>Print / JOCOS Report</strong> opens the full landscape report actually submitted — one column
            per day showing each employee's code for that day, plus totals (Days Rendered, Gross, Undertime
            Minutes, Deduction, Net, Daily/Per-Minute Rate). Fill in the Date/Prepared by/Reviewed by fields
            before printing or downloading — they're baked into the output but aren't saved anywhere, so you
            re-enter them each time. Anyone with zero attendance for the whole period is highlighted so they're
            hard to miss.
          </p>
        </CardContent>
      </Card>

      <Card id="history" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            An archive for reprinting anything already on file — not a place to edit data. Lists every past month
            with recorded attendance; drill into a month to reprint one specific employee's DTR for a specific
            half, without having to reopen the live DTR entry screen.
          </p>
        </CardContent>
      </Card>

      <Card id="activity" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            A read-only, reverse-chronological audit log of every create/update/delete made anywhere in the admin
            side — who did it and when. The place to check "did that change actually happen" or "who touched
            this."
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
