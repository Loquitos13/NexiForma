import { Badge } from "@/components/ui";
import { leadEstadoLabel, leadEstadoVariant } from "@/lib/crm/shared";

export function LeadEstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant={leadEstadoVariant(estado)}>
      {leadEstadoLabel(estado)}
    </Badge>
  );
}
