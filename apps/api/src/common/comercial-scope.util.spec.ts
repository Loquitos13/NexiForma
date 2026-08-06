import { ForbiddenException } from "@nestjs/common";
import {
  assertPropostaAcessivel,
  propostaScopeWhere,
  resolveInteraccaoListFilters,
  resolvePropostaListFilters,
  assertInteraccaoAcessivel,
  interaccaoScopeWhere,
} from "./comercial-scope.util";

describe("comercial-scope", () => {
  describe("propostaScopeWhere", () => {
    it("gestor não aplica filtro", () => {
      expect(
        propostaScopeWhere({ sub: "u1", role: "tenant_manager", tenantId: "t1" }),
      ).toBeUndefined();
    });

    it("comercial filtra pela autoria", () => {
      expect(
        propostaScopeWhere({ sub: "c1", role: "comercial", tenantId: "t1" }),
      ).toEqual({
        OR: [{ criadoPorUserId: "c1" }, { enviadaPorUserId: "c1" }],
      });
    });
  });

  describe("resolvePropostaListFilters", () => {
    it("comercial ignora comercialUserId do cliente", () => {
      expect(
        resolvePropostaListFilters(
          { sub: "c1", role: "comercial", tenantId: "t1" },
          { comercialUserId: "outro", q: "x" },
        ),
      ).toEqual({ q: "x", comercialUserId: "c1" });
    });
  });

  describe("assertPropostaAcessivel", () => {
    it("bloqueia proposta alheia", () => {
      expect(() =>
        assertPropostaAcessivel(
          { sub: "c1", role: "comercial", tenantId: "t1" },
          { criadoPorUserId: "c2", enviadaPorUserId: null },
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe("resolveInteraccaoListFilters", () => {
    it("comercial força filtro pelo próprio autor", () => {
      expect(
        resolveInteraccaoListFilters(
          { sub: "c1", role: "comercial", tenantId: "t1" },
          { comercialUserId: "c2", q: "abc" },
        ),
      ).toEqual({ q: "abc", comercialUserId: "c1" });
    });

    it("gestor mantém filtro por autor", () => {
      expect(
        resolveInteraccaoListFilters(
          { sub: "g1", role: "tenant_manager", tenantId: "t1" },
          { comercialUserId: "c2" },
        ),
      ).toEqual({ comercialUserId: "c2" });
    });
  });

  describe("interaccaoScopeWhere", () => {
    it("comercial filtra pela autoria", () => {
      expect(
        interaccaoScopeWhere({ sub: "c1", role: "comercial", tenantId: "t1" }),
      ).toEqual({
        OR: [{ criadoPorAutorId: "c1" }, { criadoPorUserId: "c1" }],
      });
    });
  });

  describe("assertInteraccaoAcessivel", () => {
    it("bloqueia nota alheia", () => {
      expect(() =>
        assertInteraccaoAcessivel(
          { sub: "c1", role: "comercial", tenantId: "t1" },
          { criadoPorAutorId: "c2", criadoPorUserId: null },
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
