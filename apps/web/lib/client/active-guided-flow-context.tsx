"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getGuidedFlowById,
  resolveGuidedFlowSteps,
  type GuidedFlowModule,
  type GuidedFlowStep,
} from "@/components/fluxo/guided-flow-modules";
import { matchesGuidedFlowHref } from "@/lib/client/guided-flow-path";
import { useGuidedFlowAccess } from "@/lib/client/use-guided-flow-access";

const ACTIVE_FLOW_STORAGE_KEY = "nexiforma-active-guided-flow";

function currentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function isOnStepHref(pathname: string, step: GuidedFlowStep | null | undefined): boolean {
  if (!step) return false;
  return matchesGuidedFlowHref(pathname, currentSearch(), step.href);
}

export type GuidedFlowProgressState = {
  moduleId: string;
  stepIndex: number;
  completed: boolean;
  minimized: boolean;
  bubbleOpen: boolean;
};

export type SupportiveMessage = {
  headline: string;
  comfort: string;
  actionGuide: string;
};

export type ActiveGuidedFlowContextValue = {
  activeModule: GuidedFlowModule | null;
  currentStepIndex: number;
  currentStep: GuidedFlowStep | null;
  totalSteps: number;
  isCompleted: boolean;
  isBubbleOpen: boolean;
  isMinimized: boolean;
  supportiveMessage: SupportiveMessage | null;
  startFlow: (moduleOrId: GuidedFlowModule | string, initialStep?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  completeFlow: () => void;
  closeFlow: () => void;
  toggleBubble: () => void;
  openBubble: () => void;
  setMinimized: (min: boolean) => void;
};

const ActiveGuidedFlowContext = createContext<ActiveGuidedFlowContextValue | null>(null);

const COMFORT_GREETINGS = [
  "Olá! Estou aqui para te acompanhar passo a passo nesta operação. Vamos a isto com calma e confiança!",
  "Excelente iniciativa! Não te preocupes com nenhum detalhe, guio-te em cada etapa do processo.",
  "Muito bem! Estou a teu lado para concluirmos esta tarefa juntos de forma rápida e segura.",
];

const COMFORT_INTERMEDIATE = [
  "Excelente progresso! Estás a avançar lindamente. Olha só o que vamos fazer a seguir:",
  "Muito bem! Estás no caminho certo. Segue a indicação abaixo que eu acompanho-te:",
  "Ótimo trabalho! Estamos a avançar passo a passo com tudo direitinho:",
  "Perfeito! Mais um passo dado. Agora vamos tratar desta parte essencial:",
];

const COMFORT_FINAL_STEP = [
  "Quase lá! Estamos no último passo para finalizar esta operação com sucesso. Força!",
  "Falta muito pouco! Dá só este último toque e teremos tudo concluído com distinção.",
];

function generateSupportiveMessage(
  module: GuidedFlowModule,
  stepIndex: number,
  isCompleted: boolean,
): SupportiveMessage {
  const steps = module.steps ?? [];
  const total = steps.length;
  const current = steps[stepIndex];

  if (isCompleted) {
    return {
      headline: "Missão cumprida com sucesso! 🎉",
      comfort:
        "Fantástico! Concluíste todas as etapas deste fluxo. Fizeste um excelente trabalho!",
      actionGuide:
        "Podes agora fechar este guia ou explorar novos fluxos no catálogo quando precisares.",
    };
  }

  if (!current) {
    return {
      headline: module.title,
      comfort: "Segue as instruções do ecrã para prosseguir.",
      actionGuide: module.description,
    };
  }

  if (stepIndex === 0) {
    const comfort =
      COMFORT_GREETINGS[Math.abs(module.id.length) % COMFORT_GREETINGS.length];
    return {
      headline: `Passo 1 de ${total}: ${current.title}`,
      comfort,
      actionGuide: current.description,
    };
  }

  if (stepIndex === total - 1) {
    const comfort =
      COMFORT_FINAL_STEP[Math.abs(module.id.length + stepIndex) % COMFORT_FINAL_STEP.length];
    return {
      headline: `Último passo (${stepIndex + 1}/${total}): ${current.title}`,
      comfort,
      actionGuide: current.description,
    };
  }

  const comfort =
    COMFORT_INTERMEDIATE[
      Math.abs(module.id.length + stepIndex) % COMFORT_INTERMEDIATE.length
    ];
  return {
    headline: `Passo ${stepIndex + 1} de ${total}: ${current.title}`,
    comfort,
    actionGuide: current.description,
  };
}

export function ActiveGuidedFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeState, setActiveState] = useState<GuidedFlowProgressState | null>(null);
  const { isModuleVisible, loading: accessLoading, ctx } = useGuidedFlowAccess();

  // Carregar estado guardado no início
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_FLOW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GuidedFlowProgressState;
        if (parsed.moduleId) {
          setActiveState({
            ...parsed,
            bubbleOpen: true,
            minimized: false,
          });
        }
      }
    } catch {
      // localStorage indisponível
    }
  }, []);

  // Limpar fluxo persistido se o papel/plano já não permite
  useEffect(() => {
    if (accessLoading || !activeState?.moduleId) return;
    if (!isModuleVisible(activeState.moduleId)) {
      setActiveState(null);
    }
  }, [accessLoading, activeState?.moduleId, isModuleVisible]);

  // Guardar estado sempre que muda
  useEffect(() => {
    try {
      if (activeState) {
        window.localStorage.setItem(
          ACTIVE_FLOW_STORAGE_KEY,
          JSON.stringify(activeState),
        );
      } else {
        window.localStorage.removeItem(ACTIVE_FLOW_STORAGE_KEY);
      }
    } catch {
      // silencioso
    }
  }, [activeState]);

  const activeModuleRaw = useMemo(() => {
    if (!activeState?.moduleId) return null;
    return getGuidedFlowById(activeState.moduleId) ?? null;
  }, [activeState?.moduleId]);

  const activeModule = useMemo(() => {
    if (!activeModuleRaw) return null;
    return {
      ...activeModuleRaw,
      steps: resolveGuidedFlowSteps(activeModuleRaw.steps, ctx.role),
    };
  }, [activeModuleRaw, ctx.role]);

  const steps = activeModule?.steps ?? [];
  const totalSteps = steps.length;
  const currentStepIndex = activeState?.stepIndex ?? 0;
  const currentStep = steps[currentStepIndex] ?? null;
  const isCompleted = activeState?.completed ?? false;
  const isBubbleOpen = activeState?.bubbleOpen ?? true;
  const isMinimized = activeState?.minimized ?? false;

  const supportiveMessage = useMemo(() => {
    if (!activeModule) return null;
    return generateSupportiveMessage(activeModule, currentStepIndex, isCompleted);
  }, [activeModule, currentStepIndex, isCompleted]);

  const startFlow = useCallback(
    (moduleOrId: GuidedFlowModule | string, initialStep = 0) => {
      const mod =
        typeof moduleOrId === "string" ? getGuidedFlowById(moduleOrId) : moduleOrId;
      if (!mod || !isModuleVisible(mod.id)) return;

      const step = mod.steps?.[initialStep];
      setActiveState({
        moduleId: mod.id,
        stepIndex: initialStep,
        completed: false,
        minimized: false,
        bubbleOpen: true,
      });

      // Navegar para o ecrã do primeiro passo se existir e se não estivermos já lá
      if (step?.href && !isOnStepHref(pathname, step)) {
        router.push(step.href);
      }
    },
    [pathname, router, isModuleVisible],
  );

  const nextStep = useCallback(() => {
    if (!activeModule) return;
    const max = (activeModule.steps?.length ?? 1) - 1;
    if (currentStepIndex >= max) {
      setActiveState((prev) => (prev ? { ...prev, completed: true, bubbleOpen: true } : null));
    } else {
      const nextIndex = currentStepIndex + 1;
      const nextStepObj = activeModule.steps?.[nextIndex];
      setActiveState((prev) =>
        prev
          ? {
              ...prev,
              stepIndex: nextIndex,
              completed: false,
              bubbleOpen: true,
            }
          : null,
      );
      if (nextStepObj?.href && !isOnStepHref(pathname, nextStepObj)) {
        router.push(nextStepObj.href);
      }
    }
  }, [activeModule, currentStepIndex, pathname, router]);

  const prevStep = useCallback(() => {
    if (!activeModule || currentStepIndex <= 0) return;
    const prevIndex = currentStepIndex - 1;
    const prevStepObj = activeModule.steps?.[prevIndex];
    setActiveState((prev) =>
      prev
        ? {
            ...prev,
            stepIndex: prevIndex,
            completed: false,
            bubbleOpen: true,
          }
        : null,
    );
    if (prevStepObj?.href && !isOnStepHref(pathname, prevStepObj)) {
      router.push(prevStepObj.href);
    }
  }, [activeModule, currentStepIndex, pathname, router]);

  const goToStep = useCallback(
    (index: number) => {
      if (!activeModule) return;
      const targetStep = activeModule.steps?.[index];
      setActiveState((prev) =>
        prev
          ? {
              ...prev,
              stepIndex: index,
              completed: false,
              bubbleOpen: true,
            }
          : null,
      );
      if (targetStep?.href && !isOnStepHref(pathname, targetStep)) {
        router.push(targetStep.href);
      }
    },
    [activeModule, pathname, router],
  );

  const completeFlow = useCallback(() => {
    setActiveState((prev) => (prev ? { ...prev, completed: true, bubbleOpen: true } : null));
  }, []);

  const closeFlow = useCallback(() => {
    setActiveState(null);
  }, []);

  const toggleBubble = useCallback(() => {
    setActiveState((prev) =>
      prev ? { ...prev, bubbleOpen: !prev.bubbleOpen, minimized: false } : null,
    );
  }, []);

  const openBubble = useCallback(() => {
    setActiveState((prev) =>
      prev ? { ...prev, bubbleOpen: true, minimized: false } : null,
    );
  }, []);

  const setMinimized = useCallback((min: boolean) => {
    setActiveState((prev) => (prev ? { ...prev, minimized: min } : null));
  }, []);

  const value = useMemo<ActiveGuidedFlowContextValue>(
    () => ({
      activeModule,
      currentStepIndex,
      currentStep,
      totalSteps,
      isCompleted,
      isBubbleOpen,
      isMinimized,
      supportiveMessage,
      startFlow,
      nextStep,
      prevStep,
      goToStep,
      completeFlow,
      closeFlow,
      toggleBubble,
      openBubble,
      setMinimized,
    }),
    [
      activeModule,
      currentStepIndex,
      currentStep,
      totalSteps,
      isCompleted,
      isBubbleOpen,
      isMinimized,
      supportiveMessage,
      startFlow,
      nextStep,
      prevStep,
      goToStep,
      completeFlow,
      closeFlow,
      toggleBubble,
      openBubble,
      setMinimized,
    ],
  );

  return (
    <ActiveGuidedFlowContext.Provider value={value}>
      {children}
    </ActiveGuidedFlowContext.Provider>
  );
}

const DEFAULT_FLOW_VALUE: ActiveGuidedFlowContextValue = {
  activeModule: null,
  currentStepIndex: 0,
  currentStep: null,
  totalSteps: 0,
  isCompleted: false,
  isBubbleOpen: false,
  isMinimized: false,
  supportiveMessage: null,
  startFlow: () => {},
  nextStep: () => {},
  prevStep: () => {},
  goToStep: () => {},
  completeFlow: () => {},
  closeFlow: () => {},
  toggleBubble: () => {},
  openBubble: () => {},
  setMinimized: () => {},
};

export function useActiveGuidedFlow(): ActiveGuidedFlowContextValue {
  const ctx = useContext(ActiveGuidedFlowContext);
  return ctx ?? DEFAULT_FLOW_VALUE;
}
