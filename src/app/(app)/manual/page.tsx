import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceCodeLegend } from "@/components/attendance-code-legend";

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "my-dtr", label: "My DTR" },
  { id: "codes", label: "Attendance codes" },
  { id: "wellness-leave", label: "Wellness Leave" },
  { id: "biometrics", label: "Biometrics" },
  { id: "salary-grades", label: "Salary Grades" },
  { id: "history", label: "History & printing" },
  { id: "profile", label: "Your profile" },
];

export default async function EmployeeManualPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manual</h1>
        <p className="text-sm text-muted-foreground">
          A guide to using JOCOS as a COS/Casual staff member — how to record your time, request Wellness Leave,
          and print your DTR. Looking for how the admin side works instead? See the{" "}
          <Link href="/admin/manual" className="underline underline-offset-2">
            Admin Manual
          </Link>{" "}
          (admin accounts only).
        </p>
      </div>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {s.label}
          </a>
        ))}
      </nav>

      <Card id="getting-started" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            You sign in with the username and password your HR admin created for you. There is no self-service
            "Forgot password" link — if you forget your password or need it reset, ask an admin to reset it for
            you from their side; they cannot see your existing password, only set a new one.
          </p>
          <p>
            Once signed in, your menu across the top has: <strong>My DTR</strong>, <strong>Salary Grades</strong>,{" "}
            <strong>Wellness Leave</strong>, <strong>Biometrics</strong>, <strong>History</strong>, and this{" "}
            <strong>Manual</strong>. Your name, role ("COS Member"), and salary grade are shown in the top-right —
            click your name/photo any time to open your <strong>Profile</strong>.
          </p>
        </CardContent>
      </Card>

      <Card id="my-dtr" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>My DTR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            This is where you record your own daily time in/out for HR to review. Use the Month / Year / Half
            filters to pick a pay period (1st half = the 1st–15th, 2nd half = the 16th to end of month).
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <strong>Nothing you enter here is official until an admin approves it.</strong> Submitting sends your
            entries to HR for review — it does not change your attendance record or pay by itself.
          </p>
          <p>For each day, you can either:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Type your <strong>AM Arrival</strong>, <strong>AM Departure</strong>, <strong>PM Arrival</strong>, and <strong>PM Departure</strong> times directly, or</li>
            <li>
              Use the <strong>Override</strong> dropdown to mark the whole day as something else — Rest Day,
              Work Suspended, Holiday, or Absent — instead of typing times.
            </li>
          </ul>
          <p>A few shortcuts that save typing:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Fill standard hours</strong> — fills every still-editable, non-overridden row with your
              scheduled hours in one click.
            </li>
            <li>The small copy icon next to a date copies the row above it into that row — handy for repeated identical shifts.</li>
            <li>
              If HR has uploaded and reviewed a biometric (fingerprint scanner) export, an empty day may already
              show suggested times pulled from it — this is only a suggestion you can edit or override, and it's
              never saved until you hit Submit.
            </li>
          </ul>
          <p>
            Once a day is <strong>Pending review</strong> or <strong>Approved</strong>, it locks — you can't edit
            or resubmit it (only an admin can reopen it). If a day comes back <strong>Returned</strong>, it stays
            editable so you can fix it and resubmit. Weekends default to Rest Day if you leave them untouched, and
            future dates are never submitted even if you happened to type something into them.
          </p>
          <p className="text-muted-foreground">
            Tip: your work schedule (which determines what counts as "on time") is set via the{" "}
            <strong>My Schedule</strong> button at the top of this page — Standard hours, one Custom set of hours
            every day, or hours that vary by day of the week. Changing it takes effect immediately, no approval
            needed.
          </p>
          <p className="text-muted-foreground">
            For a single day that doesn't follow your usual pattern (e.g. covering someone else's shift just
            once), use the small calendar icon next to that date instead — it only affects that one date, not
            your regular schedule.
          </p>
          <p className="text-muted-foreground">
            If you worked a shift that starts one date and doesn't end until the next (e.g. 8pm–5am), click the
            link icon next to the <strong>start</strong> date to flag it as continuing into the next day — enter
            your arrival on the start date's row and your departure on the next date's row, leaving the rest
            blank. This is only a note for HR to see; the two days aren't actually combined until an admin
            approves it.
          </p>
        </CardContent>
      </Card>

      <Card id="codes" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Attendance codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>These are the codes you'll see on your DTR and on the printed report, and what each one means for your pay:</p>
          <AttendanceCodeLegend />
        </CardContent>
      </Card>

      <Card id="wellness-leave" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Wellness Leave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>You get 5 Wellness Leave days a year, split into two separate buckets that don't carry over into each other:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>2 days</strong> for 1st Semester (January–June)</li>
            <li><strong>3 days</strong> for 2nd Semester (July–December)</li>
          </ul>
          <p>
            Click <strong>New Request</strong>, pick a Start and End Date (at most 3 consecutive days, and the
            whole request has to fall inside one semester — it can't straddle June/July), add a note if you like,
            and Submit.
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Unlike My DTR, Wellness Leave has <strong>no approval step</strong> — filing a request takes effect
            immediately: your balance is deducted right away and those days are marked on your attendance record.
            HR is only notified after the fact.
          </p>
          <p>
            Changed your mind? You can <strong>Pull Out</strong> a request as long as it's still{" "}
            <strong>Upcoming</strong> (its dates haven't passed) and HR hasn't already confirmed it as taken —
            pulling out restores your balance. You can also print any request, or use{" "}
            <strong>Print Blank Form</strong> at the top of the page for a paper copy.
          </p>
        </CardContent>
      </Card>

      <Card id="biometrics" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Biometrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            This page lists the fingerprint-scanner export files HR has uploaded (usually a PDF covering everyone
            at your office for a given period). Click <strong>View / Download</strong> to open one — it's a
            shared list, so you'll need to find your own name/entries inside it. There's nothing to upload or
            delete here; this is just a reference so you can copy your own real time in/out into My DTR by hand
            if it wasn't already pre-filled for you.
          </p>
        </CardContent>
      </Card>

      <Card id="salary-grades" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Salary Grades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            A read-only table of published monthly rates per salary grade (SG), along with the Daily Rate and
            Per-Minute Rate derived from it — the same numbers used to compute your Gross/Net pay on My DTR. If
            you see "No rates for {"{year}"} yet," that just means HR hasn't published rates for that year yet.
          </p>
        </CardContent>
      </Card>

      <Card id="history" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>History & printing your DTR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Lists every past month you have an <strong>official, approved</strong> DTR for, with a{" "}
            <strong>1st half</strong> / <strong>2nd half</strong> print button for each. This only shows approved
            records — anything you submitted that's still Pending or was Returned won't appear here until an
            admin approves it.
          </p>
          <p>
            The printed DTR follows the official CS Form No. 48 layout (two copies side-by-side, meant to be cut
            down the middle), and you can either use the browser's <strong>Print</strong> button or{" "}
            <strong>Download PDF</strong> to save a file.
          </p>
        </CardContent>
      </Card>

      <Card id="profile" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Click your name/photo in the top-right to open your Profile. You can choose, save, or remove a
            profile photo here (it's automatically resized to a small square before uploading). Your name,
            username, salary grade, and office assignment are managed by HR and can't be edited from here, and
            there's no self-service password change — ask an admin if you need your password reset.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
