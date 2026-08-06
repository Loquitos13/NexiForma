import { ForbiddenException } from "@nestjs/common";
import {
  extractModuloNumsFromTitulo,
  FormadorScopeService,
} from "./formador-scope.service";

describe("extractModuloNumsFromTitulo", () => {
  it("lê módulo singular e plural", () => {
    expect(extractModuloNumsFromTitulo("Aula do Módulo 3")).toEqual([3]);
    expect(extractModuloNumsFromTitulo("Sessão Módulos 5 e 6")).toEqual([5, 6]);
  });
});

describe("FormadorScopeService.assertCanOperateSessao", () => {
  const prisma = {
    sessaoFormacao: { findFirst: jest.fn(), findMany: jest.fn() },
    formadorProfile: { findFirst: jest.fn() },
    acaoFormacao: { findFirst: jest.fn() },
    moduloUnidade: { findMany: jest.fn() },
  };
  const service = new FormadorScopeService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const gestor = { sub: "u1", role: "tenant_manager", tenantId: "t1", kind: "tenant" } as never;
  const formador = { sub: "u1", role: "formador", tenantId: "t1", kind: "tenant" } as never;

  it("permite gestor", async () => {
    await expect(service.assertCanOperateSessao(gestor, "s1")).resolves.toBeUndefined();
    expect(prisma.sessaoFormacao.findFirst).not.toHaveBeenCalled();
  });

  it("bloqueia formador sem atribuição", async () => {
    prisma.sessaoFormacao.findFirst.mockResolvedValue({
      formadorId: "f-outro",
      cronograma: { acaoFormacaoId: "a1" },
    });
    prisma.formadorProfile.findFirst.mockResolvedValue({ id: "f-eu" });
    await expect(service.assertCanOperateSessao(formador, "s1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("permite formador atribuído", async () => {
    prisma.sessaoFormacao.findFirst.mockResolvedValue({
      formadorId: "f-eu",
      cronograma: { acaoFormacaoId: "a1" },
    });
    prisma.formadorProfile.findFirst.mockResolvedValue({ id: "f-eu" });
    await expect(service.assertCanOperateSessao(formador, "s1")).resolves.toBeUndefined();
  });

  it("bloqueia sessão sem formador para formador", async () => {
    prisma.sessaoFormacao.findFirst.mockResolvedValue({
      formadorId: null,
      cronograma: { acaoFormacaoId: "a1" },
    });
    await expect(service.assertCanOperateSessao(formador, "s1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe("FormadorScopeService.moduloIdsOperaveisNaAcao", () => {
  const prisma = {
    sessaoFormacao: { findMany: jest.fn(), count: jest.fn() },
    formadorProfile: { findFirst: jest.fn() },
    acaoFormacao: { findFirst: jest.fn() },
    moduloUnidade: { findMany: jest.fn() },
  };
  const service = new FormadorScopeService(prisma as never);
  const formador = { sub: "u1", role: "formador", tenantId: "t1", kind: "tenant" } as never;

  const modulos = [
    { id: "m1", titulo: "Módulo 1", ordem: 0 },
    { id: "m2", titulo: "Módulo 2", ordem: 1 },
    { id: "m3", titulo: "Módulo 3", ordem: 2 },
    { id: "m5", titulo: "Módulo 5", ordem: 4 },
    { id: "m6", titulo: "Módulo 6", ordem: 5 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.formadorProfile.findFirst.mockResolvedValue({ id: "f-eu" });
    prisma.acaoFormacao.findFirst.mockResolvedValue({ cursoId: "c1" });
    prisma.moduloUnidade.findMany.mockResolvedValue(modulos);
  });

  it("mesmo com todas as sessões, só opera módulos dessas sessões", async () => {
    prisma.sessaoFormacao.findMany.mockResolvedValue([
      { moduloUnidadeId: "m5", titulo: "Sessão M5" },
      { moduloUnidadeId: "m6", titulo: "Sessão M6" },
    ]);
    await expect(service.moduloIdsOperaveisNaAcao(formador, "a1")).resolves.toEqual([
      "m5",
      "m6",
    ]);
  });

  it("não inclui módulo 3 quando só está em sessões 5 e 6", async () => {
    prisma.sessaoFormacao.findMany.mockResolvedValue([
      { moduloUnidadeId: null, titulo: "Sessão Módulos 5 e 6" },
    ]);
    await expect(service.moduloIdsOperaveisNaAcao(formador, "a1")).resolves.toEqual([
      "m5",
      "m6",
    ]);
  });

  it("com vários formadores usa só módulos das suas sessões", async () => {
    prisma.sessaoFormacao.findMany.mockResolvedValue([
      { moduloUnidadeId: "m1", titulo: "S1" },
      { moduloUnidadeId: null, titulo: "Aula Presencial do Módulo 2" },
    ]);
    await expect(service.moduloIdsOperaveisNaAcao(formador, "a1")).resolves.toEqual(["m1", "m2"]);
  });

  it("sessões sem ligação a módulo → lista vazia (não libera tudo)", async () => {
    prisma.sessaoFormacao.findMany.mockResolvedValue([
      { moduloUnidadeId: null, titulo: "Aula geral" },
    ]);
    await expect(service.moduloIdsOperaveisNaAcao(formador, "a1")).resolves.toEqual([]);
  });

  it("assertCanLiberar bloqueia módulo fora das sessões", async () => {
    prisma.sessaoFormacao.findMany.mockResolvedValue([
      { moduloUnidadeId: "m5", titulo: "Módulo 5" },
    ]);
    await expect(
      service.assertCanLiberarModuloNaAcao(formador, "a1", "m5"),
    ).resolves.toBeUndefined();
    await expect(service.assertCanLiberarModuloNaAcao(formador, "a1", "m3")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
