/** Formato ID-1 (ISO/IEC 7810) - CC, BI e carta de condução UE. */
export const ID1_ASPECT = 85.6 / 53.98;

export type TipoDocumento = "cc" | "bi" | "carta_conducao";

export type LadoDocumento = "frente" | "verso";

export type ZonaGuia = {
  id: string;
  /** % da moldura do cartão */
  top: number;
  left: number;
  width: number;
  height: number;
  label?: string;
  className?: string;
};

export type PassoCaptura = {
  lado: LadoDocumento;
  titulo: string;
  instrucao: string;
  /** Moldura SVG (ex.: CC português) - sobreposta com baixa opacidade */
  overlaySvg?: string;
  overlayOpacity?: number;
  zonas: ZonaGuia[];
};

export type LayoutDocumento = {
  tipo: TipoDocumento;
  titulo: string;
  descricao: string;
  corMoldura: string;
  passos: PassoCaptura[];
  /** Validação heurística da proporção ID-1 */
  validarProporcao: boolean;
};

const zonaFoto: ZonaGuia = {
  id: "foto",
  top: 18,
  left: 5,
  width: 28,
  height: 52,
  label: "Fotografia",
  className: "border-dashed border-white/40 rounded-sm",
};

const zonaChip: ZonaGuia = {
  id: "chip",
  top: 58,
  left: 38,
  width: 12,
  height: 18,
  label: "Chip",
  className: "border border-amber-400/50 rounded-sm bg-amber-400/5",
};

export const DOCUMENTO_LAYOUTS: Record<TipoDocumento, LayoutDocumento> = {
  cc: {
    tipo: "cc",
    titulo: "Cartão de Cidadão",
    descricao: "Fotografa frente e verso com a moldura de alinhamento. Validação automática da proporção ID-1.",
    corMoldura: "border-teal-400/80",
    validarProporcao: true,
    passos: [
      {
        lado: "frente",
        titulo: "Frente do CC",
        instrucao: "Coloca o cartão dentro da moldura - fotografia à esquerda, símbolo de assinatura à direita.",
        overlaySvg: "/formando/molduras/cc-frente.svg",
        overlayOpacity: 0.32,
        zonas: [],
      },
      {
        lado: "verso",
        titulo: "Verso do CC",
        instrucao: "Alinha o verso do cartão - chip e zona MRZ (linhas inferiores) visíveis na moldura.",
        overlaySvg: "/formando/molduras/cc-traseira.svg",
        overlayOpacity: 0.32,
        zonas: [],
      },
    ],
  },
  bi: {
    tipo: "bi",
    titulo: "Bilhete de Identidade",
    descricao: "Documento de identificação em formato cartão. Uma captura on-camera.",
    corMoldura: "border-blue-400/80",
    validarProporcao: true,
    passos: [
      {
        lado: "frente",
        titulo: "Frente do BI",
        instrucao: "Alinha o bilhete na moldura - fotografia à esquerda.",
        zonas: [
          zonaFoto,
          {
            id: "dados",
            top: 12,
            left: 36,
            width: 58,
            height: 70,
            label: "Dados de identificação",
            className: "border border-blue-400/30 rounded-sm",
          },
        ],
      },
    ],
  },
  carta_conducao: {
    tipo: "carta_conducao",
    titulo: "Carta de Condução",
    descricao: "Carta de condução portuguesa (formato cartão UE). Uma captura on-camera.",
    corMoldura: "border-amber-400/80",
    validarProporcao: true,
    passos: [
      {
        lado: "frente",
        titulo: "Frente da carta",
        instrucao: "Alinha a carta - símbolo UE e categorias visíveis.",
        zonas: [
          {
            id: "ue",
            top: 6,
            left: 5,
            width: 14,
            height: 16,
            label: "UE",
            className: "border border-amber-300/40 rounded-full",
          },
          zonaFoto,
          {
            id: "categorias",
            top: 28,
            left: 38,
            width: 55,
            height: 55,
            label: "Categorias",
            className: "border border-amber-400/35 rounded-sm grid-pattern",
          },
        ],
      },
    ],
  },
};

export const TIPOS_DOCUMENTO: TipoDocumento[] = ["cc", "bi", "carta_conducao"];

export function labelDocumento(tipo: string, lado?: string | null): string {
  const layout = DOCUMENTO_LAYOUTS[tipo as TipoDocumento];
  if (!layout) return tipo;
  if (tipo === "cc" && lado === "verso") return `${layout.titulo} - verso`;
  if (tipo === "cc" && lado === "frente") return `${layout.titulo} - frente`;
  return layout.titulo;
}
