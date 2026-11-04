import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONTH_NAMES } from "@/lib/period";
import { canAccessOffice, requireSchedulePoster } from "@/lib/schedule-access";
import { buildTemplateWorkbook } from "@/lib/schedule-import/extract";

export async function GET(request: NextRequest) {
  const access = await requireSchedulePoster();
  const params = request.nextUrl.searchParams;
  const office = params.get("office") ?? "";
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  if (!office || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Choose an office and month first" }, { status: 400 });
  }
  if (!canAccessOffice(access, office)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employees = await prisma.employee.findMany({
    where: { officeAssignment: office, status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  const workbook = buildTemplateWorkbook(office, year, month, employees.map((e) => e.name));
  const filename = `${office} - Schedule - ${MONTH_NAMES[month - 1]} ${year}.xlsx`.replace(/[^\w .-]/g, "_");
  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
