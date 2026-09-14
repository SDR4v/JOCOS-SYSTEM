"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadBiometricDocument } from "./actions";

export function UploadForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await uploadBiometricDocument(formData);
      if (!result.error) {
        toast.success("Uploaded");
        formRef.current?.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="e.g. August 2026 — 1st half" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="periodStart">Period start (optional)</Label>
        <Input id="periodStart" name="periodStart" type="date" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="periodEnd">Period end (optional)</Label>
        <Input id="periodEnd" name="periodEnd" type="date" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="file">PDF file</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" loading={pending}>
          <UploadCloud />
          {pending ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </form>
  );
}
