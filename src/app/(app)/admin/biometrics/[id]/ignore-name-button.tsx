"use client";

import { EyeOff, Eye } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { ignoreBiometricName, unignoreBiometricName } from "../actions";

export function IgnoreNameButton({ rawName }: { rawName: string }) {
  return (
    <ActionButton
      onAction={() => ignoreBiometricName(rawName)}
      icon={EyeOff}
      label="Not an employee"
      successMessage={`"${rawName}" won't show up in unmatched review anymore`}
    />
  );
}

export function UnignoreNameButton({ rawName }: { rawName: string }) {
  return (
    <ActionButton
      onAction={() => unignoreBiometricName(rawName)}
      icon={Eye}
      label="Undo"
      successMessage={`"${rawName}" will show up in unmatched review again`}
    />
  );
}
