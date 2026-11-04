import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessOffice, requireSchedulePoster } from "@/lib/schedule-access";

// The original file exactly as uploaded, so a reading can be checked against it.
export async function GET(_request: Request, ctx: RouteContext<"/api/schedules/[id]">) {
  const access = await requireSchedulePoster();
  const { id } = await ctx.params;

  const upload = await prisma.scheduleUpload.findUnique({
    where: { id },
    select: { office: true, filename: true, fileData: true },
  });
  if (!upload || !canAccessOffice(access, upload.office)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Always a download with a neutral type: this is whatever an office uploaded,
  // and it must never render as a page on this site's origin.
  return new NextResponse(new Uint8Array(upload.fileData), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${upload.filename.replace(/["\r\n]/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
