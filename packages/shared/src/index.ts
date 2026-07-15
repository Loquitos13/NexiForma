export const APP_NAME = "NexiForma";

export const API_PREFIX = "v1";

export { HTTP_QUERY_METHOD, type HttpQueryMethod } from "./http/query-method";

export { sanitizeLmsHtml } from "./sanitize/sanitize-lms-html";

/** Roles normalizados nos JWT (independentes do enum Prisma `TenantUserRole`). */
export const JWT_ROLES = ["super_admin", "tenant_manager", "comercial", "formador", "formando"] as const;
export type JwtRole = (typeof JWT_ROLES)[number];

export const JWT_KINDS = ["platform", "tenant"] as const;
export type JwtKind = (typeof JWT_KINDS)[number];

export {
  MFA_APP_CODES,
  MFA_APP_LABELS,
  isMfaAppCode,
  mfaAppDisplayLabel,
  mfaAppOpenHint,
  mfaVerificationSubtitle,
  type MfaAppCode,
} from "./auth/mfa-apps";

export {
  canAccessPlatformArea,
  canAccessPortalArea,
  canManageCrm,
  CRM_PORTAL_PATHS,
  CRM_FATURACAO_PORTAL_PATHS,
  defaultDashboardPath,
  isPortalPathAllowedByRole,
  isComercial,
  isComercialCrmPortalPath,
  isCrmFaturacaoPortalPath,
  isCrmPortalPath,
  isFormador,
  isFormando,
  isFormandoPortalPath,
  isSuperAdmin,
  isTenantManager,
  isTenantStaff,
  resolvePostLoginPath,
  roleLandingPath,
  roleSatisfies,
  ROLE_ORDER,
} from "./access";

export {
  isLegacyFakeTeamsUrl,
  isLikelyRealTeamsJoinUrl,
  isModalidadeOnline,
  normalizeSalaJoinUrl,
  providerParaModalidade,
  resolveSalaOnline,
  type SalaOnline,
  type SalaProvider,
} from "./sala-online";

export {
  isModuloStorageRef,
  moduloConteudoMediaUrl,
  resolveModuloConteudoUrl,
} from "./modulo-media";

export {
  parseVimeoVideoId,
  parseYoutubeVideoId,
  resolveWebinarEmbedUrl,
  stripHtmlTexto,
  validarModuloConteudoCompleto,
  type ModuloConteudoLike,
} from "./lms/modulo-conteudo";

export {
  moduloDesbloqueado,
  notaMinimaParaDesbloquearProximo,
  pontuacaoModulo,
  pontuacaoTarefa,
  tarefaDesbloqueada,
  tarefasOrdenadas,
  unidadesOrdenadas,
  type ModuloPercurso,
  type ProgressoPercurso,
  type TarefaPercurso,
} from "./lms/percurso";

export {
  RGPD_TERMS_VERSION,
  buildRgpdConsentText,
  consentRequiresDecision,
  type ConsentAdminStatus,
} from "./rgpd/consent";

export {
  calcularSegundosFechados,
  calcularSegundosPresencaJoinLeave,
  formatarDuracaoHhMmSs,
  resolverEstadoPresenca,
  segundosDesdeUltimoJoin,
  ultimoJoinAberto,
  type EstadoPresencaLms,
  type LmsEventoPresenca,
} from "./lms/presenca";

export {
  ESTADOS_PRESENCA,
  ESTADO_PRESENCA_LABELS,
  estadoPresencaCsvLabel,
  isEstadoPresenca,
  labelEstadoPresencaOuPorAssinalar,
  presenteFromEstado,
  type EstadoPresenca,
} from "./lms/presenca-estado";

export {
  ALERTA_PRESENCA,
  ALERTA_PRESENCA_LABELS,
  cursoExigeEmailPresenca,
  emailPresencaConfiguradoPeloGestor,
  resolverEmailPresencaFormando,
  type AlertaPresencaCodigo,
  type EmailPresencaInput,
} from "./lms/email-presenca";

export {
  resolverEmailNotificacaoFormando,
  resolverEmailNotificacaoFormador,
  resolverEmailUtilizador,
  type EmailNotificacaoFormandoInput,
  type EmailNotificacaoFormadorInput,
} from "./notificacoes/email-destinatario";

export {
  GUIDE_DESTINATIONS,
  queryGuide,
  resolveGuideFollowUp,
  isGuideOutOfScope,
  guideOutOfScopeResult,
  resolveViewContext,
  getAllowedDestinations,
  canAccessDestination,
  findGuideDestinationByHref,
  searchGuideDestinations,
  guideResultToSearchHits,
  buildGuideLlmContext,
  buildGuideLlmSystemPrompt,
  buildGuideLlmUserPrompt,
  type GuideDestination,
  type GuideHelpResult,
  type GuideNavigateResult,
  type GuideQueryContext,
  type GuideHistoryTurn,
  type GuideResult,
  type GuideSuggestResult,
  type GuideUnknownResult,
  type GuideAnswerResult,
  type GuideOutOfScopeResult,
  type GuideSearchHit,
  type GuideViewArea,
  type GuideViewContext,
  type GuideLlmContext,
} from "./guide";

export {
  DOSSIE_DGERT_DOCUMENTOS,
  DOSSIE_DGERT_TOTAL,
  type DossieDgertDocumentoDef,
} from "./dossie/documentos-dgert";

export {
  AT_MOTIVOS_ISENCAO,
  AT_MOTIVOS_ISENCAO_LABELS,
  AT_MOTIVOS_ISENCAO_NORMA,
  AT_MOTIVO_ISENCAO_DEFAULT,
  formatarMotivoIsencaoAt,
  formatarMotivoIsencaoSelectOpcao,
  isMotivoIsencaoAtValido,
  type AtMotivoIsencaoCodigo,
} from "./faturacao/motivos-isencao-at";

export {
  buildFaturaQrPayload,
  extrairHashCharacters,
  type FaturaQrInput,
} from "./faturacao/fatura-qr";

export {
  type RelatorioAgingBucket,
  type RelatorioCohortLinha,
  type RelatorioComparacoes,
  type RelatorioComercial,
  type RelatorioComercialAvancado,
  type RelatorioConversaoPropostas,
  type RelatorioDashboard,
  type RelatorioDescricaoGrafico,
  type RelatorioEmpresarial,
  type RelatorioEmpresarialAvancado,
  type RelatorioFinanceiro,
  type RelatorioFinanceiroAvancado,
  type RelatorioFluxoCaixa,
  type RelatorioFunil,
  type RelatorioFunilEtapa,
  type RelatorioGargalo,
  type RelatorioInsightsRequest,
  type RelatorioInsightsResponse,
  type RelatorioKpi,
  type RelatorioLtvResumo,
  type RelatorioMargemItem,
  type RelatorioOrigemLead,
  type RelatorioSerieMensal,
  type RelatorioTempoProposta,
  type RelatorioTopCliente,
  type RelatorioVariacao,
} from "./relatorios";

export {
  BILLING_ADDON_CODES,
  BILLING_ADDON_LABELS,
  BILLING_CATALOG,
  BILLING_CORE_PLAN_CODES,
  BILLING_PLAN_CODES,
  BILLING_PLAN_LABELS,
  MODULAR_PLAN_CODE,
  PLAN_NATIVE_ADDONS,
  PLAN_NEGOTIABLE_ADDONS,
  PLAN_RELATORIOS_TIER,
  STANDALONE_MODULES,
  STANDALONE_PURCHASABLE_ADDONS,
  assertValidTenantSubscription,
  normalizeTenantSubscriptionAddons,
  TenantSubscriptionValidationError,
  calcularProrataCredito,
  resolveTenantEntitlements,
  INTEGRATION_PLUGINS,
  hasAnyIntegrationPlugin,
  isIntegracaoProviderAllowed,
  isIntegrationPluginAllowed,
  type IntegrationPluginDef,
  type IntegrationPluginId,
  type BillingAddonCode,
  type BillingCatalog,
  type BillingComparisonRow,
  type BillingCorePlanCode,
  type BillingPlanCode,
  type BillingPlanSummary,
  type BillingStandaloneModule,
  type PlanFeatureCell,
  type RelatoriosTier,
  type TenantEntitlements,
} from "./billing";

export {
  defaultPortalHome,
  isApiPathAllowed,
  isApiPathExempt,
  isPortalPathAllowedByEntitlements,
  navHrefAllowedByEntitlements,
  normalizeApiPath,
  PORTAL_ALWAYS_PATHS,
} from "./billing";

export {
  parseSigoCertificadosList,
  normalizeSigoNif,
  SIGO_EXPORT_SCHEMA,
  DGEEC_SUBMISSAO_SCHEMA,
  mapNexiformaToDgeecPayload,
  buildSigoSubmitHttpBody,
  type SigoCertificadoRemoto,
  type SigoCertificadoSyncResumo,
  type NexiformaSigoExportBody,
  type DgeecSigoSubmissaoPayload,
  type SigoSubmitPayloadFormat,
  SIGO_PERFIS_PADRAO,
  SIGO_ACOES_ACESSO,
  SIGO_ACAO_LABELS,
  normalizarPerfisAcesso,
  podeExecutarAcaoSigo,
  avaliarProntidaoSigoTenant,
  labelSigoRole,
  SIGO_TIPOS_DOCUMENTO,
  SIGO_TIPO_DOC_ALIASES,
  normalizarTipoDocumentoSigo,
  type FormandoSigoDTO,
  type SubmeterAcaoSigoDTO,
  type ConsultarEstadoSigoDTO,
  type SigoSoapOperacaoResponse,
  type SigoTipoDocumento,
  SIGO_PORTAIS_URL,
  SIGO_ESTADOS_ACAO,
  SIGO_TIPOS_DOC_IDENTIFICACAO,
  SIGO_HABILITACOES_CNQ,
  SIGO_SOAP_FAULT_MESSAGES,
  mapAcaoEstadoToSigo,
  traduzirSigoSoapFault,
  extrairSigoFormandoMetadata,
  type SigoAcaoAcesso,
  type SigoPerfisAcesso,
  type SigoConfigPublica,
  type SigoRegiaoPortal,
  type SigoEstadoAcao,
  type SigoFormandoMetadata,
  type SigoProtocolo,
} from "./sigo";

export {
  CRM_SUGESTAO_REJEICAO_MOTIVOS,
  type CrmDadosExtraidosIa,
  type CrmGatilhoVendaIa,
  type CrmInsightsEngine,
  type CrmNotaInsightsJson,
  type CrmProximoPassoIa,
  type CrmSugestaoRejeicaoMotivo,
} from "./crm/interacao-ia";
export {
  CRM_SUGESTAO_ACOES,
  chaveSugestaoComercial,
  inferirAcaoPlaneada,
  labelAcaoSugestao,
  mensagemAceiteSugestao,
  type CrmSugestaoAcaoExecutavel,
  type CrmSugestaoExecucao,
} from "./crm/sugestao-execucao";
export {
  CRM_WEBHOOK_EVENTS,
  type CrmAutomationAction,
  type CrmAutomationRule,
  type CrmAutomationTrigger,
  type CrmCustomFieldDef,
  type CrmCustomFieldEntity,
  type CrmCustomFieldType,
  type CrmEmailSyncConfig,
  type CrmOutboundWebhook,
  type CrmTenantConfig,
  type CrmWebhookEvent,
} from "./crm/enterprise-types";
