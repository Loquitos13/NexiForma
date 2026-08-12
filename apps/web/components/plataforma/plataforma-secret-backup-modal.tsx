"use client";

import { useEffect, useState } from "react";
import { Database, Download, HardDriveDownload, Loader2, ShieldCheck, X, Check, AlertCircle } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";

export function PlataformaSecretBackupModal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<{ key?: string; sizeBytes?: number } | null>(null);

  // Atalho de teclado global para Super Admin: Ctrl+Shift+B / Cmd+Shift+B
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function downloadInstantBackup() {
    setBusy(true);
    setError(null);
    setStatusMsg("A gerar pg_dump completo e comprimir com gzip...");
    try {
      const res = await bffFetch("/api/v1/control-plane/ops/backup/download", {
        headers: { accept: "application/gzip, application/json" },
      });
      if (!res.ok) {
        throw new Error(`Falha no backup (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `nexiforma_backup_${Date.now()}.sql.gz`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      setStatusMsg(`Download concluído: ${filename} (${sizeMb} MB)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao descarregar backup.");
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function runServerBackup() {
    setBusy(true);
    setError(null);
    setStatusMsg("A executar backup e rotação no armazenamento do servidor...");
    try {
      const res = await bffFetch("/api/v1/control-plane/ops/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Falha ao executar backup (HTTP ${res.status})`);
      }
      const data = (await res.json()) as { ok: boolean; key?: string; sizeBytes?: number; reason?: string };
      if (!data.ok) {
        throw new Error(data.reason || "Erro no processo de backup");
      }
      setLastBackup(data);
      setStatusMsg(`Backup criado e persistido: ${data.key || "OK"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar backup no servidor.");
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Painel de Backup Super Admin (Atalho: Ctrl+Shift+B)"
        className="fixed bottom-3 right-3 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-purple-950/40 hover:bg-purple-900/80 border border-purple-500/20 text-purple-400/40 hover:text-purple-200 transition-all opacity-40 hover:opacity-100 shadow-lg cursor-pointer"
      >
        <Database className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-[#0c0a14] p-6 shadow-2xl text-slate-200 ring-1 ring-purple-500/30">
        <div className="flex items-start justify-between gap-3 border-b border-purple-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-purple-100 flex items-center gap-1.5">
                Backup da Base de Dados
                <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                  Super Admin
                </span>
              </h3>
              <p className="text-xs text-slate-400">PostgreSQL · Dumps atómicos comprimidos (.sql.gz)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Gere um dump completo da base de dados PostgreSQL. Pode descarregar o ficheiro comprimido diretamente para o seu computador ou arquivá-lo no armazenamento do servidor.
        </p>

        {error ? (
          <div className="mb-4 rounded-xl bg-red-950/40 border border-red-500/30 p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {statusMsg ? (
          <div className="mb-4 rounded-xl bg-purple-950/40 border border-purple-500/30 p-3 text-xs text-purple-200 flex items-start gap-2 animate-pulse">
            <Loader2 className="h-4 w-4 shrink-0 text-purple-400 mt-0.5 animate-spin" />
            <span>{statusMsg}</span>
          </div>
        ) : null}

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadInstantBackup()}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Download className="h-4 w-4" />
              <div className="text-left">
                <span className="block font-bold">Descarregar Dump (.sql.gz)</span>
                <span className="block text-[10px] text-purple-200/80 font-normal">Gera e descarrega para o seu navegador</span>
              </div>
            </div>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4 text-purple-200" />}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void runServerBackup()}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 disabled:opacity-50 text-purple-200 text-xs font-medium transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span>Guardar no Servidor e Rodar Retenção</span>
            </div>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-slate-500" />}
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-purple-500/15 flex items-center justify-between text-[11px] text-slate-500">
          <span>Atalho rápido: <code className="text-purple-300 font-mono">Ctrl+Shift+B</code></span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
