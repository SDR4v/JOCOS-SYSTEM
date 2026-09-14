"use client";

import { Unlink } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { unlinkPunches } from "../actions";

export function UnlinkButton({ uploadId, rawName }: { uploadId: string; rawName: string }) {
  return (
    <ActionButton
      onAction={() => unlinkPunches(uploadId, rawName)}
      icon={Unlink}
      label="Unlink"
      successMessage={`"${rawName}" unlinked — back to unmatched`}
    />
  );
}
