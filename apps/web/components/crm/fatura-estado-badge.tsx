import { Badge } from "@/components/ui";
import { faturaEstadoLabel, faturaEstadoVariant } from "@/lib/crm/shared";

export function FaturaEstadoBadge({ estado }: { estado: string }) {
  return <Badge variant={faturaEstadoVariant(estado)}>{faturaEstadoLabel(estado)}</Badge>;
}
