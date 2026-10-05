"use client";

import { useEffect } from "react";
import { recordProviderWorkspaceView } from "@/features/market/server/actions";

export function ProviderWorkspaceViewRecorder({
  providerId,
}: {
  providerId: string;
}) {
  useEffect(() => {
    void recordProviderWorkspaceView(providerId).catch(() => undefined);
  }, [providerId]);

  return null;
}
