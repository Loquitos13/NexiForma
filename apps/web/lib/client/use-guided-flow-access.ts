"use client";

import { useCallback, useMemo } from "react";
import type { GuidedFlowModule } from "@/components/fluxo/guided-flow-modules";
import {
  getGuidedFlowById,
  isGuidedFlowAllowed,
  moduleIdForInteractiveView,
  visibleGuidedFlowModules,
} from "@/components/fluxo/guided-flow-modules";
import type { GuidedFlowInteractiveView } from "@/components/fluxo/guided-flow-types";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { useTenantRole } from "@/lib/client/use-tenant-role";

export function useGuidedFlowAccess() {
  const { entitlements, loading: entLoading } = useTenantEntitlements();
  const {
    role,
    canManage,
    canManageFormacao,
    canManageCrm,
    canManageFaturacao,
    loading: roleLoading,
  } = useTenantRole();

  const ctx = useMemo(
    () => ({
      ent: entitlements,
      role,
      canManage,
      canManageFormacao,
      canManageCrm,
      canManageFaturacao,
    }),
    [entitlements, role, canManage, canManageFormacao, canManageCrm, canManageFaturacao],
  );

  const visibleModules = useMemo(
    () => (entitlements ? visibleGuidedFlowModules(ctx) : []),
    [entitlements, ctx],
  );

  const isModuleVisible = useCallback(
    (moduleId: string) => isGuidedFlowAllowed(moduleId, ctx),
    [ctx],
  );

  const getModuleIfVisible = useCallback(
    (moduleId: string): GuidedFlowModule | undefined => {
      if (!isGuidedFlowAllowed(moduleId, ctx)) return undefined;
      return getGuidedFlowById(moduleId);
    },
    [ctx],
  );

  const isInteractiveViewVisible = useCallback(
    (view: GuidedFlowInteractiveView) => isModuleVisible(moduleIdForInteractiveView(view)),
    [isModuleVisible],
  );

  return {
    ctx,
    visibleModules,
    isModuleVisible,
    getModuleIfVisible,
    isInteractiveViewVisible,
    loading: entLoading || roleLoading,
  };
}
