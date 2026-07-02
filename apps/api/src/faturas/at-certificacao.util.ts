import { listarCamposEmitenteEmFalta } from "./faturacao-dados-legais.util";

export type CertificacaoAtItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  bloqueante?: boolean;
};

export type CertificacaoAtAvaliacao = {
  prontaProducao: boolean;
  prontaSandbox: boolean;
  softwareCertificado: string | null;
  softwareCertificadoOrigem: "tenant" | "plataforma" | null;
  modoServidor: "disabled" | "sandbox" | "production";
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
    iban?: string | null;
    bicSwift?: string | null;
    emailGestor?: string | null;
    capitalSocial?: string | null;
    consRegCom?: string | null;
  };
  series: Array<{ codigo: string; tipo: string; codigoValidacaoAt: string | null }>;
  softwarePlataforma: string | null;
  modoServidor: "disabled" | "sandbox" | "production";
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
  const emSandbox = modoServidor === "sandbox";

  const items: CertificacaoAtItem[] = [
    {
      id: "software_certificado",
      label: "Número de certificação do software AT",
      ok: !!sw.numero,
      detalhe: sw.numero
        ? `Certificado ${sw.numero} (${sw.origem === "tenant" ? "tenant" : "plataforma"})`
        : emSandbox
          ? "Opcional em sandbox – obrigatório em produção."
          : "Obrigatório para comunicação AT em produção - obtém-se no programa de faturação certificada.",
      bloqueante: modoServidor === "production",
    },
    {
      id: "dados_emitente",
      label: "Dados legais e bancários do emitente",
      ok: listarCamposEmitenteEmFalta(config).length === 0,
      detalhe:
        listarCamposEmitenteEmFalta(config).length === 0
          ? "Nome, NIF, morada, IBAN, BIC, email do gestor, capital social e Conservatória do Registo Comercial."
          : `Em falta: ${listarCamposEmitenteEmFalta(config).join(", ")}.`,
      bloqueante: true,
    },
    {
      id: "serie_validacao",
      label: "Código de validação AT por série",
      ok: series.some((s) => !!s.codigoValidacaoAt?.trim()),
      detalhe: series.every((s) => s.codigoValidacaoAt?.trim())
        ? "Todas as séries activas têm código AT."
        : series.some((s) => s.codigoValidacaoAt?.trim())
          ? emSandbox
            ? "Algumas séries usam código provisório – aceitável em sandbox."
            : "Comunique as séries em falta via webservice (AT_SERIES_MODE) ou Portal AT."
          : emSandbox
            ? "Comunique séries via «Registar AT» ou configure AT_SERIES_MODE=sandbox."
            : "Registe séries no Portal AT ou via webservice (subutilizador WSE).",
      bloqueante: modoServidor === "production",
    },
    {
      id: "subutilizador_wfa",
      label: "Subutilizador WFA (comunicação de faturas)",
      ok: !!config.atSubutilizador?.trim(),
      detalhe: emSandbox
        ? "Opcional em sandbox – simulação funciona sem credenciais reais."
        : "Credencial AT para comunicação automática de documentos.",
      bloqueante: modoServidor === "production",
    },
    {
      id: "password_wfa",
      label: "Password WFA configurada",
      ok: !!config.atWfaPasswordEnc?.trim(),
      detalhe: emSandbox
        ? "Opcional em sandbox."
        : "Password encriptada em base de dados - necessária para WS-Security AT.",
      bloqueante: modoServidor === "production",
    },
    {
      id: "certificado_ssl",
      label: "Certificado SSL AT (adesão produtor software)",
      ok: !!config.atCertificadoRef?.trim(),
      detalhe: config.atCertificadoRef?.trim()
        ? `Referência: ${config.atCertificadoRef}`
        : emSandbox
          ? "Não necessário em sandbox."
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
          : modoServidor === "sandbox"
            ? "Sandbox activo - simula respostas AT sem webservice real (apenas dev/staging)."
            : "Integração desactivada - configure AT_FATURAS_MODE=sandbox ou production no servidor.",
      bloqueante: false,
    },
  ];

  const bloqueantesOk = items.filter((i) => i.bloqueante).every((i) => i.ok);
  const prontaSandbox =
    emSandbox &&
    !!(config.nifEmitente?.trim() && config.nomeEmpresa?.trim());

  return {
    prontaProducao: modoServidor === "production" ? bloqueantesOk : false,
    prontaSandbox,
    softwareCertificado: sw.numero,
    softwareCertificadoOrigem: sw.origem,
    modoServidor,
    items,
    avisoLegal: emSandbox
      ? "Modo sandbox mock: simulação local. Com AT_FATURAS_MODE=sandbox (sem _SANDBOX_MOCK) usa webservice real AT (:700/:722)."
      : "A comunicação AT só deve ser activada após certificação do software e credenciais WFA válidas.",
  };
}
