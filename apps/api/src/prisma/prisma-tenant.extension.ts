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
  "MatriculaDocumento",
  "MatriculaUnidadeDesbloqueio",
  "AvaliacaoFormando",
  "TenantSubscription",
  "TenantSubscriptionKey",
  "TenantHealthCheck",
  "ImpersonationSession",
]);

const READ_OPS = new Set(["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"]);
const CREATE_OPS = new Set(["create", "createMany"]);
const MUTATION_OPS = new Set(["update", "updateMany", "delete", "deleteMany", "upsert"]);
const UNIQUE_WHERE_OPS = new Set(["findUnique", "update", "delete", "upsert"]);

function modelDelegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function isIdOnlyUniqueWhere(where: Record<string, unknown> | undefined): boolean {
  if (!where) return false;
  const keys = Object.keys(where);
  return keys.length === 1 && keys[0] === "id" && typeof where.id === "string";
}

/** Prisma nested relation ops - não são válidos em updateMany/createMany. */
const NESTED_RELATION_KEYS = new Set([
  "create",
  "createMany",
  "connect",
  "connectOrCreate",
  "disconnect",
  "delete",
  "deleteMany",
  "set",
  "update",
  "updateMany",
  "upsert",
]);

/** Detecta writes aninhados em `data` (ex.: linhas: { create: [...] }). */
export function hasNestedRelationData(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (NESTED_RELATION_KEYS.has(key)) return true;
    }
  }
  return false;
}

type ModelDelegate = {
  findFirst: (args: Record<string, unknown>) => Promise<unknown>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

function recordNotFoundError(): Error {
  const err = new Error(
    "An operation failed because it depends on one or more records that were required but not found.",
  );
  (err as Error & { code: string }).code = "P2025";
  return err;
}

function modelDelegate(client: PrismaClient, model: string): ModelDelegate {
  return (client as unknown as Record<string, ModelDelegate>)[modelDelegateKey(model)];
}

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

/** WhereUniqueInput - compõe tenant em @@unique([tenantId, …]); não usar AND. */
export function withTenantUniqueWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  if (!where || Object.keys(where).length === 0) {
    return { tenantId };
  }
  if ("tenantId" in where && where.tenantId !== undefined) {
    return where;
  }

  for (const key of Object.keys(where)) {
    if (!key.startsWith("tenantId_")) continue;
    const compound = where[key];
    if (!compound || typeof compound !== "object" || Array.isArray(compound)) continue;
    const row = compound as Record<string, unknown>;
    if (row.tenantId !== undefined) return where;
    return { ...where, [key]: { ...row, tenantId } };
  }

  return where;
}

export function injectTenantIntoArgs(
  operation: string,
  args: Record<string, unknown>,
  tenantId: string,
): void {
  if (READ_OPS.has(operation) || MUTATION_OPS.has(operation)) {
    const where = args.where as Record<string, unknown> | undefined;
    if (UNIQUE_WHERE_OPS.has(operation)) {
      args.where = withTenantUniqueWhere(where, tenantId);
    } else {
      args.where = withTenantWhere(where, tenantId);
    }
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

export function createTenantScopeExtension(getClient: () => PrismaClient) {
  return {
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

          const where = args.where as Record<string, unknown> | undefined;
          const delegate = modelDelegate(getClient(), model);

          if (operation === "findUnique" && isIdOnlyUniqueWhere(where)) {
            return delegate.findFirst({
              ...args,
              where: withTenantWhere(where, ctx.tenantId),
            });
          }

          if (operation === "update" && isIdOnlyUniqueWhere(where)) {
            const scopedWhere = withTenantWhere(where, ctx.tenantId);

            // updateMany não aceita nested writes (create/update/delete em relações).
            // Confirma ownership no tenant e deixa o update original seguir.
            if (hasNestedRelationData(args.data)) {
              const owned = await delegate.findFirst({
                where: scopedWhere,
                select: { id: true },
              });
              if (!owned) throw recordNotFoundError();
              return query(args);
            }

            const result = await delegate.updateMany({
              where: scopedWhere,
              data: args.data,
            });
            if (result.count === 0) throw recordNotFoundError();
            return delegate.findFirst({
              where: scopedWhere,
              ...(args.select ? { select: args.select } : {}),
              ...(args.include ? { include: args.include } : {}),
            });
          }

          if (operation === "delete" && isIdOnlyUniqueWhere(where)) {
            const scopedWhere = withTenantWhere(where, ctx.tenantId);
            const existing = await delegate.findFirst({
              where: scopedWhere,
              ...(args.select ? { select: args.select } : {}),
              ...(args.include ? { include: args.include } : {}),
            });
            if (!existing) throw recordNotFoundError();
            await delegate.deleteMany({ where: scopedWhere });
            return existing;
          }

          if (READ_OPS.has(operation) || CREATE_OPS.has(operation) || MUTATION_OPS.has(operation)) {
            injectTenantIntoArgs(operation, args, ctx.tenantId);
          }

          return query(args);
        },
      },
    },
  } as const;
}

export function createTenantScopedClient(base?: PrismaClient): PrismaClient {
  const client = base ?? new PrismaClient();
  let extended!: PrismaClient;
  extended = client.$extends(createTenantScopeExtension(() => extended)) as unknown as PrismaClient;
  return extended;
}

export type TenantScopedPrismaClient = PrismaClient;
