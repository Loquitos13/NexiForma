"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type EntidadeOpt = { id: string; nome: string; nif: string };
type CursoOpt = { id: string; designacao: string; codigoUfcd: string | null };

export interface PropostaFormData {
  entidadeClienteId: string;
  codigo: string;
  titulo: string;
  descricao?: string;
  valorEuros: string;
  validadeAte?: string;
  cursoId?: string;
}

interface FormPropostaProps {
  entidadeId?: string;
  onSubmit: (data: PropostaFormData) => Promise<void>;
  busy?: boolean;
}

export function FormProposta({ entidadeId, onSubmit, busy = false }: FormPropostaProps) {
  const [entidades, setEntidades] = useState<EntidadeOpt[]>([]);
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [form, setForm] = useState<PropostaFormData>({
    entidadeClienteId: entidadeId ?? "",
    codigo: "",
    titulo: "",
    descricao: "",
    valorEuros: "",
    validadeAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    cursoId: "",
  });

  const load = useCallback(async () => {
    const [eRes, cRes] = await Promise.all([
      bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }),
    ]);
    if (eRes.ok) {
      const ents = (await eRes.json()) as EntidadeOpt[];
      setEntidades(ents);
      if (!form.entidadeClienteId && ents.length && !entidadeId) {
        setForm((f) => ({ ...f, entidadeClienteId: ents[0].id }));
      }
    }
    if (cRes.ok) setCursos((await cRes.json()) as CursoOpt[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: "0.6rem", maxWidth: 520 }}>
      {!entidadeId ? (
        <label style={bo.label}>
          Entidade *
          <select
            style={bo.input}
            required
            value={form.entidadeClienteId}
            onChange={(ev) => setForm((f) => ({ ...f, entidadeClienteId: ev.target.value }))}
          >
            <option value="">Seleccione uma entidade…</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} (NIF {e.nif})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label style={bo.label}>
        Código *
        <input
          style={bo.input}
          required
          placeholder="PROP-2026-001"
          value={form.codigo}
          onChange={(ev) => setForm((f) => ({ ...f, codigo: ev.target.value }))}
        />
      </label>
      <label style={bo.label}>
        Título *
        <input
          style={bo.input}
          required
          placeholder="Formação em Python – 25h"
          value={form.titulo}
          onChange={(ev) => setForm((f) => ({ ...f, titulo: ev.target.value }))}
        />
      </label>
      <label style={bo.label}>
        Descrição
        <textarea
          style={bo.input}
          rows={3}
          placeholder="Detalhes da proposta…"
          value={form.descricao}
          onChange={(ev) => setForm((f) => ({ ...f, descricao: ev.target.value }))}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        <label style={bo.label}>
          Valor (€) *
          <input
            style={bo.input}
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            required
            value={form.valorEuros}
            onChange={(ev) => setForm((f) => ({ ...f, valorEuros: ev.target.value }))}
          />
        </label>
        <label style={bo.label}>
          Validade
          <input
            style={bo.input}
            type="date"
            value={form.validadeAte}
            onChange={(ev) => setForm((f) => ({ ...f, validadeAte: ev.target.value }))}
          />
        </label>
      </div>
      <label style={bo.label}>
        Curso (opcional)
        <select
          style={bo.input}
          value={form.cursoId}
          onChange={(ev) => setForm((f) => ({ ...f, cursoId: ev.target.value }))}
        >
          <option value="">–</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.designacao}
              {c.codigoUfcd ? ` · UFCD ${c.codigoUfcd}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy} style={bo.btn}>
        Criar proposta
      </button>
    </form>
  );
}
