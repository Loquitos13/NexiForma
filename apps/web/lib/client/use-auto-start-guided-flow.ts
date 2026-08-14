"use client";

import { useEffect } from "react";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import { useGuidedFlowAccess } from "@/lib/client/use-guided-flow-access";

/** Activa o NexiGuia (balão) ao abrir um fluxo guiado permitido para o utilizador. */
export function useAutoStartGuidedFlow(moduleId: string, initialStep = 0) {
  const { activeModule, startFlow } = useActiveGuidedFlow();
  const { isModuleVisible, loading } = useGuidedFlowAccess();

  useEffect(() => {
    if (loading || !isModuleVisible(moduleId)) return;
    if (activeModule?.id !== moduleId) {
      startFlow(moduleId, initialStep);
    }
  }, [loading, isModuleVisible, moduleId, activeModule?.id, startFlow, initialStep]);
}
