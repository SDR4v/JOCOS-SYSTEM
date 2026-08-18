import Link from "next/link";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-semibold">
              JOCOS
            </Link>
            {isAdmin ? (
              <>
                <Link href="/admin/employees" className="text-muted-foreground hover:text-foreground">
                  Employees
                </Link>
                <Link href="/admin/salary-grades" className="text-muted-foreground hover:text-foreground">
                  Salary Grades
                </Link>
                <Link href="/admin/dtr" className="text-muted-foreground hover:text-foreground">
                  DTR
                </Link>
                <Link href="/admin/payroll" className="text-muted-foreground hover:text-foreground">
                  Payroll Report
                </Link>
                <Link href="/admin/wellness-leave" className="text-muted-foreground hover:text-foreground">
                  Wellness Leave
                </Link>
              </>
            ) : (
              <>
                <Link href="/my-dtr" className="text-muted-foreground hover:text-foreground">
                  My DTR
                </Link>
                <Link href="/my-wellness-leave" className="text-muted-foreground hover:text-foreground">
                  Wellness Leave
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user.name} &middot; {user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
