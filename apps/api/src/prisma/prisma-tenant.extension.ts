import { PrismaClient } from "@nexiforma/database";
import { getTenantDbContext } from "./tenant-context";

/** Modelos Prisma com coluna obrigatória `tenant_id` (schema public + control_plane tenant-scoped). */
export const TENANT_SCOPED_MODELS = new Set<string>([
  "User",
  "TenantInvite",
  "EntidadeCliente",
  "FormandoProfile",
  "FormadorProfile",
  "Curso",
  "AcaoFormacao",
  "Turma",
  "Matricula",
  "Cronograma",
  "SessaoFormacao",
  "Sumario",
  "FolhaPresenca",
  "Presenca",
  "AcessoLms",
  "ModuloUnidade",
  "ModuloConteudo",
  "ProgressoModulo",
  "ArquivoExportacao",
  "CertificadoVerificacao",
  "PropostaComercial",
  "ConfigPropostaTenant",
  "LeadComercial",
  "InteraccaoComercial",
  "CalendarioLembreteLog",
  "SugestaoIaComercial",
  "ConfigFaturacaoTenant",
  "SerieFaturacao",
  "FaturaComercial",
  "NotificacaoPortal",
  "PushSubscription",
  "TenantIntegracao",
  "QuizPergunta",
  "QuizTentativa",
  "SigoSubmissao",
  "SigoCertificadoFormando",
  "RgpdConsent",
  "RgpdPedido",
  "DocumentoAnexo",
  "AvaliacaoFormando",
  "TenantSubscription",
  "TenantSubscriptionKey",
  "TenantHealthCheck",
  "ImpersonationSession",
]);

const READ_OPS = new Set(["findMany", "findFirst", "count", "aggregate", "groupBy"]);
const CREATE_OPS = new Set(["create", "createMany"]);

export function withTenantWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  if (!where || Object.keys(where).length === 0) {
    return { tenantId };
  }
  if ("tenantId" in where && where.tenantId !== undefined) {
    return where;
  }
  if ("AND" in where && Array.isArray(where.AND)) {
    return { AND: [...where.AND, { tenantId }] };
  }
  return { AND: [where, { tenantId }] };
}

export function injectTenantIntoArgs(
  operation: string,
  args: Record<string, unknown>,
  tenantId: string,
): void {
  if (READ_OPS.has(operation)) {
    args.where = withTenantWhere(args.where as Record<string, unknown> | undefined, tenantId);
    return;
  }

  if (operation === "create") {
    const data = args.data as Record<string, unknown> | undefined;
    if (data && data.tenantId === undefined) {
      args.data = { ...data, tenantId };
    }
    return;
  }

  if (operation === "createMany") {
    const rows = args.data as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(rows)) {
      args.data = rows.map((row) => (row.tenantId !== undefined ? row : { ...row, tenantId }));
    }
  }
}

export const tenantScopeExtension = {
  name: "tenantScope",
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model: string;
        operation: string;
        args: Record<string, unknown>;
        query: (a: Record<string, unknown>) => Promise<unknown>;
      }) {
        const ctx = getTenantDbContext();
        if (ctx.bypassRls || !ctx.tenantId || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        if (READ_OPS.has(operation) || CREATE_OPS.has(operation)) {
          injectTenantIntoArgs(operation, args, ctx.tenantId);
        }

        return query(args);
      },
    },
  },
} as const;

export function createTenantScopedClient(base?: PrismaClient): PrismaClient {
  const client = base ?? new PrismaClient();
  return client.$extends(tenantScopeExtension) as unknown as PrismaClient;
}

export type TenantScopedPrismaClient = PrismaClient;
