export type CertificacaoAtItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  bloqueante?: boolean;
};

export type CertificacaoAtAvaliacao = {
  prontaProducao: boolean;
  softwareCertificado: string | null;
  softwareCertificadoOrigem: "tenant" | "plataforma" | null;
  modoServidor: "disabled" | "production";
  items: CertificacaoAtItem[];
  avisoLegal: string;
};

type AvaliarInput = {
  config: {
    nifEmitente: string;
    moradaFiscal: string | null;
    atSubutilizador: string | null;
    atWfaPasswordEnc?: string | null;
    atCertificadoRef: string | null;
    softwareCertificado: string | null;
    comunicacaoAtiva: boolean;
    nomeEmpresa: string;
  };
  series: Array<{ codigo: string; tipo: string; codigoValidacaoAt: string | null }>;
  softwarePlataforma: string | null;
  modoServidor: "disabled" | "production";
};

export function resolverSoftwareCertificado(
  configSoftware: string | null | undefined,
  plataformaSoftware: string | null | undefined,
): { numero: string | null; origem: "tenant" | "plataforma" | null } {
  const tenant = configSoftware?.trim();
  if (tenant) return { numero: tenant, origem: "tenant" };
  const plataforma = plataformaSoftware?.trim();
  if (plataforma) return { numero: plataforma, origem: "plataforma" };
  return { numero: null, origem: null };
}

export function avaliarCertificacaoAt(input: AvaliarInput): CertificacaoAtAvaliacao {
  const { config, series, softwarePlataforma, modoServidor } = input;
  const sw = resolverSoftwareCertificado(config.softwareCertificado, softwarePlataforma);

  const items: CertificacaoAtItem[] = [
    {
      id: "software_certificado",
      label: "Número de certificação do software AT",
      ok: !!sw.numero,
      detalhe: sw.numero
        ? `Certificado ${sw.numero} (${sw.origem === "tenant" ? "tenant" : "plataforma"})`
        : "Obrigatório para comunicação AT em produção - obtém-se no programa de faturação certificada.",
      bloqueante: true,
    },
    {
      id: "dados_emitente",
      label: "Dados legais do emitente (NIF, morada, nome)",
      ok: !!(config.nifEmitente?.trim() && config.moradaFiscal?.trim() && config.nomeEmpresa?.trim()),
      detalhe: "Nome, morada fiscal e NIF preenchidos na configuração.",
      bloqueante: true,
    },
    {
      id: "serie_validacao",
      label: "Código de validação AT por série",
      ok: series.some((s) => !!s.codigoValidacaoAt?.trim()),
      detalhe: series.every((s) => s.codigoValidacaoAt?.trim())
        ? "Todas as séries activas têm código AT."
        : series.some((s) => s.codigoValidacaoAt?.trim())
          ? "Algumas séries usam código provisório - regista o código oficial na AT antes de produção."
          : "Regista o código de validação de série no Portal das Finanças.",
      bloqueante: modoServidor === "production",
    },
    {
      id: "subutilizador_wfa",
      label: "Subutilizador WFA (comunicação de faturas)",
      ok: !!config.atSubutilizador?.trim(),
      detalhe: "Credencial AT para comunicação automática de documentos.",
      bloqueante: true,
    },
    {
      id: "password_wfa",
      label: "Password WFA configurada",
      ok: !!config.atWfaPasswordEnc?.trim(),
      detalhe: "Password encriptada em base de dados - necessária para WS-Security AT.",
      bloqueante: true,
    },
    {
      id: "certificado_ssl",
      label: "Certificado SSL AT (adesão produtor software)",
      ok: !!config.atCertificadoRef?.trim(),
      detalhe: config.atCertificadoRef?.trim()
        ? `Referência: ${config.atCertificadoRef}`
        : "Recomendado em produção - identificador do certificado do processo de adesão.",
      bloqueante: false,
    },
    {
      id: "modo_servidor",
      label: "Modo servidor AT",
      ok: modoServidor !== "disabled",
      detalhe:
        modoServidor === "production"
          ? "Produção AT activa - exige certificação e credenciais válidas."
          : "Integração desactivada - configure AT_FATURAS_MODE=production no servidor.",
      bloqueante: false,
    },
  ];

  const bloqueantesOk = items.filter((i) => i.bloqueante).every((i) => i.ok);
  const prontaProducao = modoServidor === "production" ? bloqueantesOk : bloqueantesOk;

  return {
    prontaProducao,
    softwareCertificado: sw.numero,
    softwareCertificadoOrigem: sw.origem,
    modoServidor,
    items,
    avisoLegal:
      "A comunicação AT só deve ser activada após certificação do software e credenciais WFA válidas.",
  };
}
