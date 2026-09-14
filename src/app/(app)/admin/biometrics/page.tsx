import Link from "next/link";
import { FileText, ListChecks } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/utils";
import { UploadForm } from "./upload-form";
import { DeleteButton } from "./delete-button";

export default async function AdminBiometricsPage() {
  await requireAdmin();

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
      status: true,
      uploadedBy: { select: { username: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Biometrics</h1>
        <p className="text-sm text-muted-foreground">
          Upload the biometrics machine&apos;s exported PDF here — employees can open it to copy their own time in/out
          into My DTR by hand until RFID auto-capture is in place.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded files</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.periodStart && u.periodEnd
                          ? `${u.periodStart.toISOString().slice(0, 10)} – ${u.periodEnd.toISOString().slice(0, 10)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.filename} &middot; {formatFileSize(u.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.uploadedAt.toISOString().slice(0, 10)} &middot; {u.uploadedBy.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.status === "REVIEWED" ? "default" : u.status === "PROCESSED" ? "secondary" : "outline"}>
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/biometrics/${u.id}`}>
                            <Button type="button" variant="outline" size="sm">
                              <ListChecks />
                              Review
                            </Button>
                          </Link>
                          <Link href={`/api/biometrics/${u.id}`} target="_blank">
                            <Button type="button" variant="outline" size="sm">
                              <FileText />
                              View
                            </Button>
                          </Link>
                          <DeleteButton id={u.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
