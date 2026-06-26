"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Verificacao = {
  valido: boolean;
  codigoPublico: string;
  emitidoEm: string;
  revogadoEm?: string | null;
  motivo?: string;
  formando?: { nome: string; nif: string };
  entidade?: { legalName: string; nif: string | null };
  acao?: { codigoInterno: string; titulo: string; dataInicio: string; dataFim: string };
  curso?: { designacao: string; codigoUfcd: string | null; cargaHoras: number };
  taxaPresenca?: number | null;
  elegivelCertificado?: boolean;
};

export default function VerificarCertificadoPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? "");
  const [data, setData] = useState<Verificacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/verificacao/certificados/${encodeURIComponent(token)}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          setError(`Verificação indisponível (${res.status}).`);
          return;
        }
        setData((await res.json()) as Verificacao);
      } catch {
        setError("Falha de rede.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "2rem auto",
        padding: "0 1.25rem",
        fontFamily: "system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none" }}>
          NexiForma
        </Link>
      </p>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Verificação de certificado</h1>
      <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: "1.5rem" }}>
        Validação pública de autenticidade – entidades formadoras certificadas DGERT.
      </p>

      {loading ? <p style={{ color: "#64748b" }}>A verificar…</p> : null}
      {error ? <p style={{ color: "#dc2626" }}>{error}</p> : null}

      {data ? (
        <section
          style={{
            border: `2px solid ${data.valido ? "#16a34a" : "#dc2626"}`,
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            background: data.valido ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              color: data.valido ? "#15803d" : "#b91c1c",
              margin: "0 0 0.75rem",
            }}
          >
            {data.valido ? "Certificado válido" : "Certificado inválido ou revogado"}
          </p>
          {data.motivo ? (
            <p style={{ color: "#7f1d1d", fontSize: "0.9rem", margin: "0 0 0.75rem" }}>{data.motivo}</p>
          ) : null}
          <dl style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.7 }}>
            <div>
              <dt style={{ color: "#64748b", display: "inline" }}>Código: </dt>
              <dd style={{ display: "inline", fontWeight: 600 }}>{data.codigoPublico}</dd>
            </div>
            {data.formando ? (
              <div>
                <dt style={{ color: "#64748b", display: "inline" }}>Formando: </dt>
                <dd style={{ display: "inline" }}>
                  {data.formando.nome} · NIF {data.formando.nif}
                </dd>
              </div>
            ) : null}
            {data.entidade ? (
              <div>
                <dt style={{ color: "#64748b", display: "inline" }}>Entidade: </dt>
                <dd style={{ display: "inline" }}>
                  {data.entidade.legalName}
                  {data.entidade.nif ? ` · NIF ${data.entidade.nif}` : ""}
                </dd>
              </div>
            ) : null}
            {data.acao ? (
              <div>
                <dt style={{ color: "#64748b", display: "inline" }}>Acção: </dt>
                <dd style={{ display: "inline" }}>
                  {data.acao.codigoInterno} – {data.acao.titulo} ({data.acao.dataInicio} a {data.acao.dataFim})
                </dd>
              </div>
            ) : null}
            {data.curso ? (
              <div>
                <dt style={{ color: "#64748b", display: "inline" }}>Curso: </dt>
                <dd style={{ display: "inline" }}>
                  {data.curso.designacao}
                  {data.curso.codigoUfcd ? ` · UFCD ${data.curso.codigoUfcd}` : ""} · {data.curso.cargaHoras}h
                </dd>
              </div>
            ) : null}
            {data.taxaPresenca != null ? (
              <div>
                <dt style={{ color: "#64748b", display: "inline" }}>Presença: </dt>
                <dd style={{ display: "inline" }}>{data.taxaPresenca}%</dd>
              </div>
            ) : null}
            <div>
              <dt style={{ color: "#64748b", display: "inline" }}>Emitido: </dt>
              <dd style={{ display: "inline" }}>
                {data.emitidoEm ? new Date(data.emitidoEm).toLocaleString("pt-PT") : "–"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
