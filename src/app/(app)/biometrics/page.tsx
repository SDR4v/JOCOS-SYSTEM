import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/utils";

export default async function BiometricsPage() {
  await requireUser();

  const uploads = await prisma.biometricUpload.findMany({
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      title: true,
      filename: true,
      fileSize: true,
      periodStart: true,
      periodEnd: true,
      uploadedAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Biometrics</h1>
        <p className="text-sm text-muted-foreground">
          HR&apos;s uploaded exports from the biometrics machine — open one to copy your own time in/out into My DTR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded files</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <ul className="divide-y">
              {uploads.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">{u.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.periodStart && u.periodEnd
                        ? `${u.periodStart.toISOString().slice(0, 10)} – ${u.periodEnd.toISOString().slice(0, 10)} · `
                        : ""}
                      {u.filename} &middot; {formatFileSize(u.fileSize)}
                    </p>
                  </div>
                  <Link href={`/api/biometrics/${u.id}`} target="_blank">
                    <Button type="button" variant="outline" size="sm">
                      <FileText />
                      View / Download
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
