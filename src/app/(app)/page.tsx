import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Users, BadgeDollarSign, Clock, Inbox, Receipt, HeartPulse, Fingerprint, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/my-dtr");
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [employeeCount, pendingDtrRequests, upcomingWellnessLeave] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.dtrEntryRequest.count({ where: { status: "PENDING" } }),
    prisma.wellnessLeaveRequest.count({
      where: { status: "ACTIVE", endDate: { gte: today }, confirmedTakenAt: null },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-primary/80 px-6 py-7 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 right-24 size-40 rounded-full bg-brand-gold/10" />
        <div className="relative">
          <h1 className="text-2xl font-semibold">Welcome back, {user.name?.split(",")[0] ?? user.name}</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Here&apos;s what&apos;s happening across JOCOS today.</p>
        </div>

        <div className="relative mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Active COS Workers" value={employeeCount} icon={Users} />
          <StatCard
            label="Pending DTR Requests"
            value={pendingDtrRequests}
            icon={Inbox}
            href="/admin/dtr-requests"
            highlight={pendingDtrRequests > 0}
          />
          <StatCard label="Upcoming Wellness Leave" value={upcomingWellnessLeave} icon={HeartPulse} href="/admin/wellness-leave" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Manage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard href="/admin/employees" title="Employees" description="Manage the COS roster" icon={Users} />
          <DashboardCard
            href="/admin/salary-grades"
            title="Salary Grades"
            description="Manage the SG rate table"
            icon={BadgeDollarSign}
          />
          <DashboardCard href="/admin/dtr" title="DTR" description="Enter daily attendance" icon={Clock} />
          <DashboardCard
            href="/admin/dtr-requests"
            title="DTR Requests"
            description="Review employee-submitted entries"
            icon={Inbox}
            badge={pendingDtrRequests}
          />
          <DashboardCard href="/admin/payroll" title="Daily Rate Computation" description="Generate the JOCOS report" icon={Receipt} />
          <DashboardCard
            href="/admin/wellness-leave"
            title="Wellness Leave"
            description="Balances and request tracking"
            icon={HeartPulse}
          />
          <DashboardCard
            href="/admin/biometrics"
            title="Biometrics"
            description="Upload the biometrics PDF export"
            icon={Fingerprint}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <div className="flex items-center gap-3 rounded-xl bg-card/95 p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className={
          highlight
            ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold"
            : "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        }
      >
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function DashboardCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-brand-gold transition-transform duration-300 group-hover:scale-x-100" />
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {!!badge && badge > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold text-white">
              {badge}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}
