import { Badge } from "@/components/ui";
import { propostaEstadoLabel, propostaEstadoVariant } from "@/lib/crm/shared";

export function PropostaEstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant={propostaEstadoVariant(estado)}>
      {propostaEstadoLabel(estado)}
    </Badge>
  );
}
