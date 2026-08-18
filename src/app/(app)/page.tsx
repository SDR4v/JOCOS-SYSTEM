import Link from "next/link";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/my-dtr");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard href="/admin/employees" title="Employees" description="Manage the COS roster" />
        <DashboardCard href="/admin/salary-grades" title="Salary Grades" description="Manage the SG rate table" />
        <DashboardCard href="/admin/dtr" title="DTR" description="Enter daily attendance" />
        <DashboardCard href="/admin/payroll" title="Payroll Report" description="Generate the JOCOS report" />
        <DashboardCard href="/admin/wellness-leave" title="Wellness Leave" description="Balances and approval requests" />
      </div>
    </div>
  );
}

function DashboardCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </Link>
  );
}
