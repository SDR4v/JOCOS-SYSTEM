import Link from "next/link";
import Image from "next/image";
import {
  Users,
  BadgeDollarSign,
  Clock,
  Inbox,
  Receipt,
  HeartPulse,
  LogOut,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { NavLink } from "@/components/nav-link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const pendingDtrRequests = isAdmin ? await prisma.dtrEntryRequest.count({ where: { status: "PENDING" } }) : 0;

  const initial = (user.name ?? user.username).charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Image src="/batac-seal.jpg" alt="" width={32} height={32} className="rounded-full" />
              <div className="leading-tight">
                <div className="font-heading text-sm font-bold tracking-wide">JOCOS</div>
                <div className="hidden text-[0.65rem] text-muted-foreground sm:block">City of Batac</div>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-1">
              {isAdmin ? (
                <>
                  <NavLink href="/admin/employees" icon={<Users className="size-4" />}>
                    Employees
                  </NavLink>
                  <NavLink href="/admin/salary-grades" icon={<BadgeDollarSign className="size-4" />}>
                    Salary Grades
                  </NavLink>
                  <NavLink href="/admin/dtr" icon={<Clock className="size-4" />}>
                    DTR
                  </NavLink>
                  <NavLink href="/admin/dtr-requests" icon={<Inbox className="size-4" />} badge={pendingDtrRequests}>
                    DTR Requests
                  </NavLink>
                  <NavLink href="/admin/payroll" icon={<Receipt className="size-4" />}>
                    Payroll Report
                  </NavLink>
                  <NavLink href="/admin/wellness-leave" icon={<HeartPulse className="size-4" />}>
                    Wellness Leave
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink href="/my-dtr" icon={<Clock className="size-4" />}>
                    My DTR
                  </NavLink>
                  <NavLink href="/my-wellness-leave" icon={<HeartPulse className="size-4" />}>
                    Wellness Leave
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initial}
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.role === "ADMIN" ? "Administrator" : "COS Member"}</div>
              </div>
            </div>
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
