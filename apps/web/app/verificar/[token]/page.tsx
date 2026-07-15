"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldX, Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

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

async function fetchVerificacao(token: string): Promise<Verificacao | null> {
  const res = await fetch(`/api/v1/verificacao/certificados/${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Verificacao;
}

function ResultCard({ data }: { data: Verificacao }) {
  return (
    <section
      className={`rounded-2xl border-2 p-6 ${
        data.valido
          ? "border-emerald-500/40 bg-emerald-950/20"
          : "border-red-500/40 bg-red-950/20"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        {data.valido ? (
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
        ) : (
          <ShieldX className="h-6 w-6 text-red-400" />
        )}
        <p className={`text-lg font-semibold ${data.valido ? "text-emerald-300" : "text-red-300"}`}>
          {data.valido ? "Certificado válido" : "Certificado inválido ou revogado"}
        </p>
      </div>
      {data.motivo ? <p className="mb-3 text-sm text-red-300">{data.motivo}</p> : null}
      <dl className="space-y-2 text-sm text-slate-300">
        <div>
          <dt className="inline text-slate-500">Código: </dt>
          <dd className="inline font-mono font-semibold">{data.codigoPublico}</dd>
        </div>
        {data.formando ? (
          <div>
            <dt className="inline text-slate-500">Formando: </dt>
            <dd className="inline">
              {data.formando.nome} · NIF {data.formando.nif}
            </dd>
          </div>
        ) : null}
        {data.entidade ? (
          <div>
            <dt className="inline text-slate-500">Entidade: </dt>
            <dd className="inline">
              {data.entidade.legalName}
              {data.entidade.nif ? ` · NIF ${data.entidade.nif}` : ""}
            </dd>
          </div>
        ) : null}
        {data.acao ? (
          <div>
            <dt className="inline text-slate-500">Acção: </dt>
            <dd className="inline">
              {data.acao.codigoInterno} – {data.acao.titulo}
            </dd>
          </div>
        ) : null}
        {data.curso ? (
          <div>
            <dt className="inline text-slate-500">Curso: </dt>
            <dd className="inline">
              {data.curso.designacao}
              {data.curso.codigoUfcd ? ` · UFCD ${data.curso.codigoUfcd}` : ""} · {data.curso.cargaHoras}h
            </dd>
          </div>
        ) : null}
        {data.taxaPresenca != null ? (
          <div>
            <dt className="inline text-slate-500">Presença: </dt>
            <dd className="inline">{data.taxaPresenca}%</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-slate-500">Emitido: </dt>
          <dd className="inline">
            {data.emitidoEm ? new Date(data.emitidoEm).toLocaleString("pt-PT") : "–"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function VerificarCertificadoPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const tokenFromUrl = decodeURIComponent(params.token ?? "");
  const [codigo, setCodigo] = useState(tokenFromUrl.startsWith("NF-") ? "" : "");
  const [data, setData] = useState<Verificacao | null>(null);
  const [loading, setLoading] = useState(!!tokenFromUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenFromUrl) return;
    void (async () => {
      setLoading(true);
      setError(null);
      const result = await fetchVerificacao(tokenFromUrl);
      if (!result) setError("Certificado não encontrado ou código inválido.");
      else setData(result);
      setLoading(false);
    })();
  }, [tokenFromUrl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = codigo.trim();
    if (!q) return;
    router.push(`/verificar/${encodeURIComponent(q)}`);
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link href="/" className="text-sm text-cyan-400 hover:underline">
          NexiForma
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Verificação de certificado</h1>
        <p className="mt-1 text-sm text-slate-400">
          Valida a autenticidade com o código do certificado ou o link do QR code.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex gap-2">
          <input
            className="h-10 flex-1 rounded-lg border border-slate-600/60 bg-slate-900/80 px-3 text-sm placeholder:text-slate-500"
            placeholder="Código NF-XXXXXXXX ou token do QR"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-500"
          >
            <Search className="h-4 w-4" />
            Verificar
          </button>
        </form>

        {loading ? <p className="mt-6 text-sm text-slate-500">A verificar…</p> : null}
        {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}
        {data ? <div className="mt-6"><ResultCard data={data} /></div> : null}
      </div>
    </main>
  );
}
