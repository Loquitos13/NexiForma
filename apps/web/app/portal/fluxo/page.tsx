"use client";

import dynamic from "next/dynamic";

const CourseFlowBuilder = dynamic(
  () => import("@/components/fluxo/CourseFlowBuilder"),
  { ssr: false, loading: () => <div className="p-6 text-sm text-slate-500">A carregar editor visual...</div> },
);

export default function FluxoPage() {
  return <CourseFlowBuilder />;
}
