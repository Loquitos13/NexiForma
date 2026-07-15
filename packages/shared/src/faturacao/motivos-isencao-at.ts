/**
 * Códigos oficiais AT para motivo de isenção / não liquidação de IVA.
 * Tabela AT (comunicação e-Fatura, SAF-T) - vigente desde 01/2023; M44–M46 desde 2025.
 * PDF: Tabela_Codigos_Motivo_Isencao.pdf (Portal das Finanças).
 * Códigos suprimidos: M03 (exigibilidade de caixa), M08 (autoliquidação genérica).
 */
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

/** Menção que deve constar na fatura (texto visível ao cliente). */
export const AT_MOTIVOS_ISENCAO_LABELS: Record<AtMotivoIsencaoCodigo, string> = {
  M01: "Artigo 16.º n.º 6 do CIVA",
  M02: "Artigo 6.º do Decreto-Lei n.º 198/90, de 19 de junho",
  M04: "Isento artigo 13.º do CIVA",
  M05: "Isento artigo 14.º do CIVA",
  M06: "Isento artigo 15.º do CIVA",
  M07: "Isento artigo 9.º do CIVA",
  M09: "IVA – não confere direito a dedução",
  M10: "IVA – regime de isenção",
  M11: "Regime particular do tabaco",
  M12: "Regime da margem de lucro – Agências de viagens",
  M13: "Regime da margem de lucro – Bens em segunda mão",
  M14: "Regime da margem de lucro – Objetos de arte",
  M15: "Regime da margem de lucro – Objetos de coleção e antiguidades",
  M16: "Isento artigo 14.º do RITI",
  M19: "Outras isenções",
  M20: "IVA – regime forfetário",
  M21: "IVA – não confere direito a dedução (ou expressão similar)",
  M25: "Mercadorias à consignação",
  M26: "Isenção de IVA com direito à dedução no cabaz alimentar",
  M30: "IVA – autoliquidação",
  M31: "IVA – autoliquidação",
  M32: "IVA – autoliquidação",
  M33: "IVA – autoliquidação",
  M34: "IVA – autoliquidação",
  M40: "IVA – autoliquidação",
  M41: "IVA – autoliquidação",
  M42: "IVA – autoliquidação",
  M43: "IVA – autoliquidação",
  M44: "IVA – Regras específicas – artigo 6.º",
  M45: "IVA – regime transfronteiriço de isenção",
  M46: "IVA – e-TaxFree",
  M99: "Não sujeito; não tributado",
};

/** Enquadramento legal (norma aplicável - distingue códigos com a mesma menção). */
export const AT_MOTIVOS_ISENCAO_NORMA: Record<AtMotivoIsencaoCodigo, string> = {
  M01: "Art. 16.º n.º 6 al. a) a d) do CIVA",
  M02: "Art. 6.º do DL 198/90, de 19 de junho",
  M04: "Art. 13.º do CIVA",
  M05: "Art. 14.º do CIVA",
  M06: "Art. 15.º do CIVA",
  M07: "Art. 9.º do CIVA",
  M09: "Art. 62.º al. b) do CIVA",
  M10: "Art. 57.º do CIVA",
  M11: "DL 346/85, de 23 de agosto",
  M12: "DL 221/85, de 3 de julho",
  M13: "DL 199/96, de 18 de outubro",
  M14: "DL 199/96, de 18 de outubro",
  M15: "DL 199/96, de 18 de outubro",
  M16: "Art. 14.º do RITI",
  M19: "Isenções temporárias em diploma próprio",
  M20: "Art. 59.º-D n.º 2 do CIVA",
  M21: "Art. 72.º n.º 4 do CIVA",
  M25: "Art. 38.º n.º 1 al. a) do CIVA",
  M26: "Lei n.º 17/2023, de 14 de abril",
  M30: "Art. 2.º n.º 1 al. i) do CIVA - resíduos e sucatas",
  M31: "Art. 2.º n.º 1 al. j) do CIVA - construção civil",
  M32: "Art. 2.º n.º 1 al. l) do CIVA - direitos de emissão de gases",
  M33: "Art. 2.º n.º 1 al. m) do CIVA",
  M34: "Art. 2.º n.º 1 al. n) do CIVA",
  M40: "Art. 6.º n.º 6 al. a) do CIVA, a contrário",
  M41: "Art. 8.º n.º 3 do RITI",
  M42: "DL 21/2007, de 29 de janeiro",
  M43: "DL 362/99, de 16 de setembro",
  M44: "Art. 6.º do CIVA - operações não localizadas em Portugal",
  M45: "Art. 58.º-A do CIVA - regime transfronteiriço",
  M46: "DL 19/2017, de 14 de fevereiro - e-TaxFree",
  M99: "Art. 2.º, 3.º ou 4.º do CIVA (não sujeito / não tributado)",
};

export const AT_MOTIVO_ISENCAO_DEFAULT: AtMotivoIsencaoCodigo = "M07";

/** Texto para impressão / secção «Condições de enquadramento de IVA». */
export function formatarMotivoIsencaoAt(codigo: string): string {
  const c = codigo.toUpperCase() as AtMotivoIsencaoCodigo;
  const label = AT_MOTIVOS_ISENCAO_LABELS[c];
  return label ? `${c} - ${label}` : codigo;
}

/** Texto para o select da fatura - inclui norma quando ajuda a distinguir códigos. */
export function formatarMotivoIsencaoSelectOpcao(codigo: AtMotivoIsencaoCodigo): string {
  const label = AT_MOTIVOS_ISENCAO_LABELS[codigo];
  const norma = AT_MOTIVOS_ISENCAO_NORMA[codigo];
  return `${codigo} - ${label} (${norma})`;
}

export function isMotivoIsencaoAtValido(code: string | null | undefined): code is AtMotivoIsencaoCodigo {
  return !!code && AT_MOTIVOS_ISENCAO.includes(code.toUpperCase() as AtMotivoIsencaoCodigo);
}
