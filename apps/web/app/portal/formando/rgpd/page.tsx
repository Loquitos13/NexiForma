"use client";

import { MyRgpdSettings } from "@/components/consent/my-rgpd-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FormandoRgpdPage() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Privacidade e RGPD</h1>
        <p className="text-sm text-slate-400 mt-1">
          Consulta e gere o teu consentimento sobre tratamento de dados pessoais.
        </p>
      </div>

      <Card className="border-slate-700/30 bg-slate-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Definições RGPD</CardTitle>
        </CardHeader>
        <CardContent>
          <MyRgpdSettings />
        </CardContent>
      </Card>
    </div>
  );
}
