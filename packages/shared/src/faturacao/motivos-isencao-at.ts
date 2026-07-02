/** Códigos oficiais AT (Portaria 302/2016, tabela v4.0). */
export const AT_MOTIVOS_ISENCAO = [
  "M01",
  "M02",
  "M04",
  "M05",
  "M06",
  "M07",
  "M09",
  "M10",
  "M11",
  "M12",
  "M13",
  "M14",
  "M15",
  "M16",
  "M19",
  "M20",
  "M21",
  "M25",
  "M26",
  "M30",
  "M31",
  "M32",
  "M33",
  "M34",
  "M35",
  "M40",
  "M41",
  "M42",
  "M43",
  "M44",
  "M45",
  "M46",
  "M99",
] as const;

export type AtMotivoIsencaoCodigo = (typeof AT_MOTIVOS_ISENCAO)[number];

/** Texto legal resumido para impressão / select (sem acentos problemáticos). */
export const AT_MOTIVOS_ISENCAO_LABELS: Record<AtMotivoIsencaoCodigo, string> = {
  M01: "Artigo 16.º n.º 6 do CIVA",
  M02: "Artigo 6.º do Decreto-Lei n.º 198/90",
  M04: "Isento artigo 13.º do CIVA",
  M05: "Isento artigo 14.º do CIVA",
  M06: "Isento artigo 15.º do CIVA",
  M07: "Isento artigo 9.º do CIVA (ou similar)",
  M09: "IVA - nao confere direito a deducao",
  M10: "Isento artigo 9.º do CIVA",
  M11: "Regime particular do tabaco",
  M12: "Regime da margem de lucro - agencias viagens",
  M13: "Regime da margem de lucro - bens em segunda mao",
  M14: "Regime da margem de lucro - objetos de arte",
  M15: "Regime da margem de lucro - objetos de colecao/antiguidades",
  M16: "Isento artigo 14.º do RITI",
  M19: "Outras isencoes - aviacao civil",
  M20: "Isento artigo 9.º do CIVA",
  M21: "Isento artigo 9.º do CIVA",
  M25: "Mercadorias postas a disposicao na Azores/Madeira",
  M26: "Isento artigo 15.º do CIVA",
  M30: "Isento artigo 9.º do CIVA",
  M31: "Isento artigo 9.º do CIVA",
  M32: "Isento artigo 9.º do CIVA",
  M33: "Isento artigo 9.º do CIVA",
  M34: "Isento artigo 9.º do CIVA",
  M35: "Isento artigo 9.º do CIVA",
  M40: "Isento artigo 9.º do CIVA",
  M41: "Isento artigo 9.º do CIVA",
  M42: "Isento artigo 9.º do CIVA",
  M43: "Isento artigo 9.º do CIVA",
  M44: "Isento artigo 9.º do CIVA",
  M45: "Isento artigo 9.º do CIVA",
  M46: "Isento artigo 9.º do CIVA",
  M99: "Nao sujeito; nao tributado (ou similar)",
};

export const AT_MOTIVO_ISENCAO_DEFAULT: AtMotivoIsencaoCodigo = "M07";

export function formatarMotivoIsencaoAt(codigo: string): string {
  const c = codigo.toUpperCase() as AtMotivoIsencaoCodigo;
  const label = AT_MOTIVOS_ISENCAO_LABELS[c];
  return label ? `${c} - ${label}` : codigo;
}

export function isMotivoIsencaoAtValido(code: string | null | undefined): code is AtMotivoIsencaoCodigo {
  return !!code && AT_MOTIVOS_ISENCAO.includes(code.toUpperCase() as AtMotivoIsencaoCodigo);
}
