"use client";

import { FileText, Handshake } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";

type ClienteRowActionsProps = {
  isParceiro: boolean;
  busy: boolean;
  showFaturacao?: boolean;
  onEmitirFatura: () => void;
  onTornarParceiro: () => void;
};

export function ClienteRowActions({
  isParceiro,
  busy,
  showFaturacao = false,
  onEmitirFatura,
  onTornarParceiro,
}: ClienteRowActionsProps) {
  return (
    <ActionMenu
      side="left"
      iconOnly
      items={[
        ...(showFaturacao
          ? [
              {
                label: "Emitir fatura",
                icon: <FileText className="h-4 w-4 text-blue-400" />,
                disabled: busy,
                onClick: onEmitirFatura,
              },
            ]
          : []),
        {
          label: isParceiro ? "Já é parceiro" : "Tornar parceiro",
          icon: <Handshake className="h-4 w-4 text-teal-400" />,
          disabled: busy || isParceiro,
          onClick: onTornarParceiro,
        },
      ]}
    />
  );
}
