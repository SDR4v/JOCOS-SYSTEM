import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, LogOut } from "lucide-react";
import {
  EmployeesIcon,
  SalaryGradesIcon,
  DtrIcon,
  DtrRequestsIcon,
  PayrollIcon,
  WellnessLeaveIcon,
  CalendarIcon,
  BiometricsIcon,
  HistoryIcon,
  ActivityIcon,
  MonitoringIcon,
} from "@/components/nav-icons";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getHalfMonthRange, type Half } from "@/lib/period";
import { countEmployeesWithIncompleteDtr } from "@/lib/dtr-monitoring";
import { NavLink } from "@/components/nav-link";
import { LiquidNav } from "@/components/liquid-nav";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const now0 = new Date();
  const currentHalf: Half = now0.getDate() <= 15 ? 1 : 2;
  const { start: currentPeriodStart, end: currentPeriodEnd } = getHalfMonthRange(
    now0.getFullYear(),
    now0.getMonth() + 1,
    currentHalf,
  );

  const [pendingDtrRequests, incompleteDtrCount, employee] = await Promise.all([
    isAdmin ? prisma.dtrEntryRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isAdmin ? countEmployeesWithIncompleteDtr(currentPeriodStart, currentPeriodEnd) : Promise.resolve(0),
    !isAdmin && user.employeeId
      ? prisma.employee.findUnique({ where: { id: user.employeeId }, select: { salaryGrade: true } })
      : Promise.resolve(null),
  ]);

  const initial = (user.name ?? user.username).charAt(0).toUpperCase();

  // Built once and rendered in both the desktop bar and the mobile drawer so
  // the two never drift out of sync.
  const navItems = isAdmin
    ? [
        { href: "/admin/employees", icon: <EmployeesIcon className="size-4" />, label: "Employees" },
        { href: "/admin/salary-grades", icon: <SalaryGradesIcon className="size-4" />, label: "Salary Grades" },
        { href: "/admin/holidays", icon: <CalendarIcon className="size-4" />, label: "Calendar" },
        { href: "/admin/biometrics", icon: <BiometricsIcon className="size-4" />, label: "Biometrics" },
        { href: "/admin/dtr", icon: <DtrIcon className="size-4" />, label: "DTR" },
        { href: "/admin/dtr-requests", icon: <DtrRequestsIcon className="size-4" />, label: "DTR Requests", badge: pendingDtrRequests },
        { href: "/admin/monitoring", icon: <MonitoringIcon className="size-4" />, label: "Monitoring", badge: incompleteDtrCount },
        { href: "/admin/wellness-leave", icon: <WellnessLeaveIcon className="size-4" />, label: "Wellness Leave" },
        { href: "/admin/payroll", icon: <PayrollIcon className="size-4" />, label: "Daily Rate Computation" },
        { href: "/admin/history", icon: <HistoryIcon className="size-4" />, label: "History" },
        { href: "/admin/activity", icon: <ActivityIcon className="size-4" />, label: "Activity" },
      ]
    : [
        { href: "/my-dtr", icon: <DtrIcon className="size-4" />, label: "My DTR" },
        { href: "/salary-grades", icon: <SalaryGradesIcon className="size-4" />, label: "Salary Grades" },
        { href: "/my-wellness-leave", icon: <WellnessLeaveIcon className="size-4" />, label: "Wellness Leave" },
        { href: "/biometrics", icon: <BiometricsIcon className="size-4" />, label: "Biometrics" },
        { href: "/history", icon: <HistoryIcon className="size-4" />, label: "History" },
      ];

  // Admin gets the navy "authority" colorway (matching the print reports and
  // login), employees get the seal's green — same background photo, tinted
  // differently so the two portals read as distinct at a glance.
  const tintClass = isAdmin
    ? "bg-gradient-to-b from-primary/15 via-background/60 to-primary/10"
    : "bg-gradient-to-b from-brand-green/15 via-background/60 to-brand-gold/15";

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="fixed inset-0 flex items-center justify-center print:hidden">
        <Image src="/batac-logo.jpg" alt="" width={720} height={720} priority className="opacity-10" />
      </div>
      <div className={`pointer-events-none fixed inset-0 print:hidden ${tintClass}`} />
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="relative mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-4 lg:h-auto lg:py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image src="/batac-seal.jpg" alt="" width={32} height={32} className="rounded-full" />
              <div className="leading-tight">
                <div className="font-heading text-sm font-bold tracking-wide">JOCOS</div>
                <div className="hidden text-[0.65rem] text-muted-foreground sm:block">City of Batac</div>
              </div>
            </Link>

            <LiquidNav className="hidden lg:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} icon={item.icon} badge={item.badge}>
                  {item.label}
                </NavLink>
              ))}
            </LiquidNav>
          </div>

          {/* Desktop: full identity + sign out inline. */}
          <div className="hidden items-center gap-3 lg:flex">
            <Suspense fallback={<Button type="button" variant="outline" size="icon" disabled><Bell /></Button>}>
              <NotificationBellSection userId={user.id} />
            </Suspense>
            <Link href="/profile" className="flex items-center gap-2 rounded-md text-sm hover:bg-accent" title="Profile">
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                <Suspense fallback={initial}>
                  <UserAvatarImage userId={user.id} initial={initial} />
                </Suspense>
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {user.role === "ADMIN" ? "Administrator" : "COS Member"}
                  {employee ? ` · SG ${employee.salaryGrade}` : ""}
                </div>
              </div>
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                <LogOut />
                Sign out
              </Button>
            </form>
          </div>

          {/* Mobile/tablet: compact bell + hamburger; everything else lives in the drawer. */}
          <div className="flex items-center gap-2 lg:hidden">
            <Suspense fallback={<Button type="button" variant="outline" size="icon" disabled><Bell /></Button>}>
              <NotificationBellSection userId={user.id} />
            </Suspense>
            <MobileNav>
              <LiquidNav className="flex-col items-stretch gap-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} href={item.href} icon={item.icon} badge={item.badge}>
                    {item.label}
                  </NavLink>
                ))}
              </LiquidNav>
              <div className="mt-4 flex items-center gap-2 border-t pt-4">
                <Link
                  href="/profile"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
                  title="Profile"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    <Suspense fallback={initial}>
                      <UserAvatarImage userId={user.id} initial={initial} />
                    </Suspense>
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {user.role === "ADMIN" ? "Administrator" : "COS Member"}
                      {employee ? ` · SG ${employee.salaryGrade}` : ""}
                    </span>
                  </span>
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <Button type="submit" variant="outline" size="sm">
                    <LogOut />
                    Sign out
                  </Button>
                </form>
              </div>
            </MobileNav>
          </div>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

// Streamed independently so a slow notification/avatar fetch never holds up
// the rest of the page shell on every navigation.
async function NotificationBellSection({ userId }: { userId: string }) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notification.count({ where: { recipientId: userId, read: false } }),
  ]);

  return <NotificationBell notifications={notifications} unreadCount={unreadCount} />;
}

async function UserAvatarImage({ userId, initial }: { userId: string; initial: string }) {
  const avatar = await prisma.userAvatar.findUnique({
    where: { userId },
    select: { mimeType: true, fileData: true },
  });

  if (!avatar) return initial;

  const avatarDataUri = `data:${avatar.mimeType};base64,${Buffer.from(avatar.fileData).toString("base64")}`;
  // eslint-disable-next-line @next/next/no-img-element -- small user-uploaded blob, not worth Next/Image optimization
  return <img src={avatarDataUri} alt="" className="size-full object-cover" />;
}
