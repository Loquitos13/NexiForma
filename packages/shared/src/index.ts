export const APP_NAME = "NexiForma";

export const API_PREFIX = "v1";

/** Roles normalizados nos JWT (independentes do enum Prisma `TenantUserRole`). */
export const JWT_ROLES = ["super_admin", "tenant_manager", "comercial", "formador", "formando"] as const;
export type JwtRole = (typeof JWT_ROLES)[number];

export const JWT_KINDS = ["platform", "tenant"] as const;
export type JwtKind = (typeof JWT_KINDS)[number];

export {
  canAccessPlatformArea,
  canAccessPortalArea,
  canManageCrm,
  CRM_PORTAL_PATHS,
  defaultDashboardPath,
  isComercial,
  isCrmPortalPath,
  isFormador,
  isFormando,
  isSuperAdmin,
  isTenantManager,
  isTenantStaff,
  resolvePostLoginPath,
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
  GUIDE_DESTINATIONS,
  queryGuide,
  resolveGuideFollowUp,
  isGuideOutOfScope,
  guideOutOfScopeResult,
  resolveViewContext,
  getAllowedDestinations,
  canAccessDestination,
  findGuideDestinationByHref,
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
  type GuideViewArea,
  type GuideViewContext,
  type GuideLlmContext,
} from "./guide";

export {
  DOSSIE_DGERT_DOCUMENTOS,
  DOSSIE_DGERT_TOTAL,
  type DossieDgertDocumentoDef,
} from "./dossie/documentos-dgert";
