"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type AcaoOption = { id: string; codigoInterno: string; titulo: string };

type TurmaRow = {
  id: string;
  codigo: string;
  nome: string;
  acaoFormacaoId: string;
  _count?: { matriculas: number };
};

type FormandoRow = {
  id: string;
  nome: string;
  nif: string;
  email?: string | null;
  emailPresenca?: string | null;
  emailConta?: string | null;
  emailPresencaEfectivo?: string | null;
  _count?: { matriculas: number };
};

type MatriculaRow = {
  id: string;
  estado: string;
  formando: {
    nome: string;
    nif: string;
    emailPresencaEfectivo?: string | null;
  };
};

type Props = {
  acoes: AcaoOption[];
  canManage: boolean;
};

export function PortalEnrollmentSection({ acoes, canManage }: Props) {
  const [selectedAcaoId, setSelectedAcaoId] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [formandos, setFormandos] = useState<FormandoRow[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [turmaCodigo, setTurmaCodigo] = useState("T-B");
  const [turmaNome, setTurmaNome] = useState("Turma B (tarde)");
  const [formandoNome, setFormandoNome] = useState("");
  const [formandoNif, setFormandoNif] = useState("");
  const [formandoEmail, setFormandoEmail] = useState("");
  const [matriculaFormandoId, setMatriculaFormandoId] = useState("");

  useEffect(() => {
    if (acoes.length && !selectedAcaoId) {
      setSelectedAcaoId(acoes[0].id);
    }
  }, [acoes, selectedAcaoId]);

  const loadFormandos = useCallback(async () => {
    const res = await bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } });
    if (res.ok) {
      setFormandos((await res.json()) as FormandoRow[]);
    }
  }, []);

  const loadTurmas = useCallback(async (acaoId: string) => {
    if (!acaoId) {
      setTurmas([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const rows = (await res.json()) as TurmaRow[];
      setTurmas(rows);
      setSelectedTurmaId((prev) =>
        rows.length ? (rows.some((t) => t.id === prev) ? prev : rows[0].id) : "",
      );
    }
  }, []);

  const loadMatriculas = useCallback(async (turmaId: string) => {
    if (!turmaId) {
      setMatriculas([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      setMatriculas((await res.json()) as MatriculaRow[]);
    }
  }, []);

  useEffect(() => {
    void loadFormandos();
  }, [loadFormandos]);

  useEffect(() => {
    void loadTurmas(selectedAcaoId);
  }, [selectedAcaoId, loadTurmas]);

  useEffect(() => {
    void loadMatriculas(selectedTurmaId);
  }, [selectedTurmaId, loadMatriculas]);

  async function parseError(res: Response): Promise<string> {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return `HTTP ${res.status}`;
  }

  async function updateMatriculaEstado(id: string, estado: string) {
    if (!canManage) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/matriculas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Matrícula actualizada.");
      await loadMatriculas(selectedTurmaId);
    } finally {
      setBusy(false);
    }
  }

  async function submitTurma(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedAcaoId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          acaoFormacaoId: selectedAcaoId,
          codigo: turmaCodigo,
          nome: turmaNome,
        }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Turma criada.");
      await loadTurmas(selectedAcaoId);
    } catch {
      setErr("Falha ao criar turma.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFormando(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/formandos", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          nome: formandoNome,
          nif: formandoNif,
          email: formandoEmail || undefined,
        }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Formando registado.");
      setFormandoNome("");
      setFormandoNif("");
      setFormandoEmail("");
      await loadFormandos();
    } catch {
      setErr("Falha ao registar formando.");
    } finally {
      setBusy(false);
    }
  }

  const formandoSeleccionado = formandos.find((f) => f.id === matriculaFormandoId);
  const formandoSemEmailReuniao = formandoSeleccionado && !formandoSeleccionado.emailPresencaEfectivo;

  async function submitMatricula(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedTurmaId || !matriculaFormandoId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/matriculas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          turmaId: selectedTurmaId,
          formandoId: matriculaFormandoId,
        }),
      });
      if (!res.ok) {
        setErr(await parseError(res));
        return;
      }
      setMsg("Matrícula efectuada.");
      await loadMatriculas(selectedTurmaId);
      await loadFormandos();
      await loadTurmas(selectedAcaoId);
    } catch {
      setErr("Falha na matrícula.");
    } finally {
      setBusy(false);
    }
  }

  if (!acoes.length) {
    return (
      <section style={{ ...card, marginTop: "1.25rem" }}>
        <h2 style={h2}>Turmas, formandos e matrículas</h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Cria primeiro uma acção de formação (seed ou API) para gerir turmas.
        </p>
      </section>
    );
  }

  return (
    <section style={{ ...card, marginTop: "1.25rem" }}>
      <h2 style={h2}>Turmas, formandos e matrículas</h2>
      <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: "1rem" }}>
        Fluxo típico DGERT: acção → turma → formando → matrícula na turma.
      </p>

      {msg ? (
        <p style={{ color: "#86efac", fontSize: "0.88rem", marginBottom: "0.65rem" }}>{msg}</p>
      ) : null}
      {err ? (
        <p role="alert" style={{ color: "#fca5a5", fontSize: "0.88rem", marginBottom: "0.65rem" }}>
          {err}
        </p>
      ) : null}

      <label style={labelSx}>
        Acção de formação
        <select
          value={selectedAcaoId}
          onChange={(e) => setSelectedAcaoId(e.target.value)}
          style={inputSx}
        >
          {acoes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigoInterno} – {a.titulo}
            </option>
          ))}
        </select>
      </label>

      <div style={{ marginTop: "1rem" }}>
        <h3 style={h3}>Turmas desta acção</h3>
        {turmas.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Sem turmas.</p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", margin: "0 0 0.75rem" }}>
            {turmas.map((t) => (
              <li key={t.id} style={{ color: "#e2e8f0", fontSize: "0.9rem", marginBottom: "0.35rem" }}>
                <strong>{t.codigo}</strong> – {t.nome}
                {t._count ? ` (${t._count.matriculas} matrículas)` : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form onSubmit={(e) => void submitTurma(e)} style={{ display: "grid", gap: "0.65rem", maxWidth: 420 }}>
            <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>Nova turma</span>
            <input
              value={turmaCodigo}
              onChange={(e) => setTurmaCodigo(e.target.value)}
              placeholder="Código (ex. T-B)"
              required
              style={inputSx}
            />
            <input
              value={turmaNome}
              onChange={(e) => setTurmaNome(e.target.value)}
              placeholder="Nome da turma"
              required
              style={inputSx}
            />
            <button type="submit" disabled={busy} style={btnPrimary}>
              Criar turma
            </button>
          </form>
        ) : null}
      </div>

      <div style={{ marginTop: "1.35rem" }}>
        <h3 style={h3}>Formandos ({formandos.length})</h3>
        {formandos.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.88rem" }}>Sem formandos registados.</p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", margin: "0 0 0.75rem", maxHeight: 140, overflow: "auto" }}>
            {formandos.map((f) => (
              <li key={f.id} style={{ color: "#e2e8f0", fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                {f.nome} · NIF {f.nif}
                {f.emailPresencaEfectivo ? (
                  <span style={{ color: "#94a3b8" }}> · {f.emailPresencaEfectivo}</span>
                ) : (
                  <span style={{ color: "#fbbf24" }}> · sem email reunião</span>
                )}
                {f._count ? ` · ${f._count.matriculas} matr.` : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form onSubmit={(e) => void submitFormando(e)} style={{ display: "grid", gap: "0.65rem", maxWidth: 420 }}>
            <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>Novo formando</span>
            <input
              value={formandoNome}
              onChange={(e) => setFormandoNome(e.target.value)}
              placeholder="Nome completo"
              required
              style={inputSx}
            />
            <input
              value={formandoNif}
              onChange={(e) => setFormandoNif(e.target.value)}
              placeholder="NIF"
              required
              style={inputSx}
            />
            <input
              type="email"
              value={formandoEmail}
              onChange={(e) => setFormandoEmail(e.target.value)}
              placeholder="Email (opcional)"
              style={inputSx}
            />
            <button type="submit" disabled={busy} style={btnPrimary}>
              Registar formando
            </button>
          </form>
        ) : null}
      </div>

      <div style={{ marginTop: "1.35rem" }}>
        <h3 style={h3}>Matrículas</h3>
        <label style={labelSx}>
          Turma
          <select
            value={selectedTurmaId}
            onChange={(e) => setSelectedTurmaId(e.target.value)}
            style={inputSx}
            disabled={!turmas.length}
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} – {t.nome}
              </option>
            ))}
          </select>
        </label>

        {matriculas.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "0.5rem" }}>
            Nenhuma matrícula nesta turma.
          </p>
        ) : (
          <ul style={{ paddingLeft: "1.1rem", margin: "0.75rem 0" }}>
            {matriculas.map((m) => (
              <li key={m.id} style={{ color: "#e2e8f0", fontSize: "0.88rem", marginBottom: "0.35rem" }}>
                {m.formando.nome} (NIF {m.formando.nif})
                {canManage ? (
                  <select
                    value={m.estado}
                    onChange={(e) => void updateMatriculaEstado(m.id, e.target.value)}
                    disabled={busy}
                    style={{ ...inputSx, marginLeft: "0.5rem", maxWidth: 160, display: "inline-block" }}
                  >
                    {["ATIVA", "CONCLUSAO", "DESISTENCIA"].map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                ) : (
                  <> – {m.estado}</>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && turmas.length && formandos.length ? (
          <form onSubmit={(e) => void submitMatricula(e)} style={{ display: "grid", gap: "0.65rem", maxWidth: 420 }}>
            <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>Matricular formando na turma seleccionada</span>
            <select
              value={matriculaFormandoId}
              onChange={(e) => setMatriculaFormandoId(e.target.value)}
              required
              style={inputSx}
            >
              <option value="">– escolher formando –</option>
              {formandos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.nif})
                  {f.emailPresencaEfectivo ? "" : " - sem email reunião"}
                </option>
              ))}
            </select>
            {formandoSemEmailReuniao ? (
              <p style={{ color: "#fbbf24", fontSize: "0.8rem", margin: 0, lineHeight: 1.4 }}>
                Turmas online exigem email de presença - edita o formando em Formandos (email de reunião ou conta
                NexiForma).
              </p>
            ) : null}
            <button type="submit" disabled={busy || !matriculaFormandoId} style={btnPrimary}>
              Matricular
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

const card: CSSProperties = {
  padding: "1.1rem 1.25rem",
  borderRadius: 12,
  background: "rgba(15,23,42,0.65)",
  border: "1px solid rgba(148,163,184,0.22)",
};
const h2: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "1.05rem",
  fontWeight: 600,
  color: "#f1f5f9",
};
const h3: CSSProperties = {
  margin: "0 0 0.45rem",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#e2e8f0",
};
const labelSx: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  color: "#cbd5e1",
  fontSize: "0.88rem",
  maxWidth: 480,
};
const inputSx: CSSProperties = {
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.85)",
  color: "#f1f5f9",
};
const btnPrimary: CSSProperties = {
  padding: "0.5rem 0.85rem",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  justifySelf: "start",
};
