"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { GuidedFlowBackBar, GuidedFlowHub, useGuidedFlowView } from "@/components/fluxo/GuidedFlowHub";
import { GuidedFlowGuide } from "@/components/fluxo/GuidedFlowGuide";
import { FormationSetupWizard } from "@/components/fluxo/FormationSetupWizard";
import { moduleIdForInteractiveView } from "@/components/fluxo/guided-flow-modules";
import type { GuidedFlowInteractiveView } from "@/components/fluxo/guided-flow-types";
import { useAutoStartGuidedFlow } from "@/lib/client/use-auto-start-guided-flow";
import { useGuidedFlowAccess } from "@/lib/client/use-guided-flow-access";

const GuidedLmsContentEditor = dynamic(
  () => import("@/components/fluxo/GuidedLmsContentEditor"),
  { ssr: false, loading: () => <div className="p-6 text-sm text-slate-500">A carregar editor de conteúdos…</div> },
);

function InteractiveGuidedView({
  view,
  label,
  onBack,
  children,
}: {
  view: GuidedFlowInteractiveView;
  label: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  useAutoStartGuidedFlow(moduleIdForInteractiveView(view));
  const { isInteractiveViewVisible, loading } = useGuidedFlowAccess();

  if (!loading && !isInteractiveViewVisible(view)) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Este fluxo guiado não está disponível para o teu perfil ou plano.
      </div>
    );
  }

  return (
    <>
      <GuidedFlowBackBar label={label} onBack={onBack} />
      {children}
    </>
  );
}

function FluxoContent() {
  const [view, setView] = useGuidedFlowView();

  if (view.kind === "interactive" && view.view === "setup-completo") {
    return (
      <InteractiveGuidedView
        view="setup-completo"
        label="Nova formação completa"
        onBack={() => setView("hub")}
      >
        <FormationSetupWizard />
      </InteractiveGuidedView>
    );
  }

  if (view.kind === "interactive" && view.view === "conteudos") {
    return (
      <InteractiveGuidedView
        view="conteudos"
        label="Conteúdos LMS"
        onBack={() => setView("hub")}
      >
        <GuidedLmsContentEditor />
      </InteractiveGuidedView>
    );
  }

  if (view.kind === "guide") {
    return (
      <>
        <GuidedFlowBackBar label={view.module.title} onBack={() => setView("hub")} />
        <GuidedFlowGuide module={view.module} />
      </>
    );
  }

  return <GuidedFlowHub onOpen={(target) => setView(target)} />;
}

export default function FluxoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">A carregar fluxo guiado…</div>}>
      <FluxoContent />
    </Suspense>
  );
}
