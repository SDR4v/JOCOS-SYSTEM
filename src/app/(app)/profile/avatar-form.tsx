"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAvatar, removeAvatar } from "./actions";

// Downscales/center-crops to a small square JPEG in the browser before
// upload — keeps every stored photo tiny regardless of what the employee
// picked, with no server-side image library needed.
function resizeToSquareJpeg(file: File, size = 256, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported in this browser"));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode that image"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

export function AvatarForm({ currentAvatar, initial }: { currentAvatar: string | null; initial: string }) {
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      const blob = await resizeToSquareJpeg(file);
      setPendingBlob(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't process that image");
    }
  }

  function handleSave() {
    if (!pendingBlob) return;
    const formData = new FormData();
    formData.set("file", pendingBlob, "avatar.jpg");
    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Profile photo updated");
        setPendingBlob(null);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.error) toast.error(result.error);
      else {
        toast.success("Profile photo removed");
        setPreview(null);
        setPendingBlob(null);
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- locally resized blob/data URI, not an optimizable remote asset
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera />
            Choose photo
          </Button>
          {preview && (
            <Button type="button" variant="outline" size="sm" onClick={handleRemove} loading={pending}>
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
        {pendingBlob && (
          <Button type="button" size="sm" onClick={handleSave} loading={pending}>
            {pending ? "Saving..." : "Save photo"}
          </Button>
        )}
      </div>
    </div>
  );
}
