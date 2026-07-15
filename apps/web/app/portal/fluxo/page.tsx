"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { GuidedFlowBackBar, GuidedFlowHub, useGuidedFlowView } from "@/components/fluxo/GuidedFlowHub";
import { FormationSetupWizard } from "@/components/fluxo/FormationSetupWizard";

const CourseFlowBuilder = dynamic(
  () => import("@/components/fluxo/CourseFlowBuilder"),
  { ssr: false, loading: () => <div className="p-6 text-sm text-slate-500">A carregar editor visual…</div> },
);

function FluxoContent() {
  const [view, setView] = useGuidedFlowView();

  if (view === "setup-completo") {
    return (
      <>
        <GuidedFlowBackBar label="Nova formação completa" onBack={() => setView("hub")} />
        <FormationSetupWizard />
      </>
    );
  }

  if (view === "conteudos") {
    return (
      <>
        <GuidedFlowBackBar label="Editor de conteúdos LMS" onBack={() => setView("hub")} />
        <CourseFlowBuilder />
      </>
    );
  }

  return <GuidedFlowHub onOpenView={(v) => setView(v)} />;
}

export default function FluxoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">A carregar fluxo guiado…</div>}>
      <FluxoContent />
    </Suspense>
  );
}
