"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { GuidedFlowBackBar, GuidedFlowHub, useGuidedFlowView } from "@/components/fluxo/GuidedFlowHub";
import { GuidedFlowGuide } from "@/components/fluxo/GuidedFlowGuide";
import { FormationSetupWizard } from "@/components/fluxo/FormationSetupWizard";

const CourseFlowBuilder = dynamic(
  () => import("@/components/fluxo/CourseFlowBuilder"),
  { ssr: false, loading: () => <div className="p-6 text-sm text-slate-500">A carregar editor visual…</div> },
);

function FluxoContent() {
  const [view, setView] = useGuidedFlowView();

  if (view.kind === "interactive" && view.view === "setup-completo") {
    return (
      <>
        <GuidedFlowBackBar label="Nova formação completa" onBack={() => setView("hub")} />
        <FormationSetupWizard />
      </>
    );
  }

  if (view.kind === "interactive" && view.view === "conteudos") {
    return (
      <>
        <GuidedFlowBackBar label="Editor de conteúdos LMS" onBack={() => setView("hub")} />
        <CourseFlowBuilder />
      </>
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
