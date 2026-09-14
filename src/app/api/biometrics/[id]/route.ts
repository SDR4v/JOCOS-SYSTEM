import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, ctx: RouteContext<"/api/biometrics/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;

  const upload = await prisma.biometricUpload.findUnique({
    where: { id },
    select: { filename: true, mimeType: true, fileData: true },
  });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(upload.fileData), {
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Disposition": `inline; filename="${upload.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
