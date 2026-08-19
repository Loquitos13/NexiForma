"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  isAcceptedSignatureImageFile,
  processSignatureImageFileDetailed,
  type SignatureProcessOptions,
} from "@/lib/client/signature-image.util";
import { Button } from "@/components/ui";
import { takeFileFromInput } from "@/lib/ui/file-input.util";

type PortalUser = {
  id: string;
  displayName: string;
  email: string;
  role: string;
};

type SignatureRow = {
  id: string;
  userId: string;
  displayName?: string;
  signatureUrl: string;
  userDisplayName: string | null;
  userEmail: string | null;
};

export function TenantSignaturePanel() {
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [threshold, setThreshold] = useState<number | null>(null);
  const [contrast, setContrast] = useState<number | null>(null);
  const [autoThreshold, setAutoThreshold] = useState<number | null>(null);
  const [alreadyTransparent, setAlreadyTransparent] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const uploadInputId = useId();

  const load = useCallback(async () => {
    const [sigRes, usersRes] = await Promise.all([
      bffFetch("/api/v1/portal/tenant/signatures", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/users", { headers: { accept: "application/json" } }),
    ]);
    if (sigRes.ok) {
      const data = (await sigRes.json()) as { signatures: SignatureRow[] };
      setSignatures(data.signatures ?? []);
    }
    if (usersRes.ok) {
      const raw = (await usersRes.json()) as Record<string, unknown>[];
      setUsers(
        raw
          .filter((u) => String(u.role) !== "FORMANDO")
          .map((u) => ({
            id: String(u.id),
            displayName: String(u.displayName ?? u.email ?? u.id),
            email: String(u.email ?? ""),
            role: String(u.role ?? ""),
          })),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedUserIds = useMemo(
    () => new Set(signatures.map((s) => s.userId).filter(Boolean)),
    [signatures],
  );

  const availableUsers = useMemo(
    () => users.filter((u) => !assignedUserIds.has(u.id) || u.id === selectedUserId),
    [users, assignedUserIds, selectedUserId],
  );

  const editingSignature = signatures.find((s) => s.userId === selectedUserId);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      setAlreadyTransparent(false);
      return;
    }
    let cancelled = false;
    const opts: SignatureProcessOptions = {};
    if (showFineTune) {
      if (threshold != null) opts.threshold = threshold;
      if (contrast != null) opts.contrast = contrast;
    }
    void processSignatureImageFileDetailed(pendingFile, opts).then((result) => {
      if (cancelled) return;
      if (!showFineTune || threshold == null) {
        setAutoThreshold(result.autoThreshold);
        setAlreadyTransparent(Boolean(result.alreadyTransparent));
      }
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pendingFile, threshold, contrast, showFineTune]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function resetForm() {
    setSelectedUserId("");
    setDisplayName("");
    setPendingFile(null);
    setPendingFileName(null);
    setThreshold(null);
    setContrast(null);
    setShowFineTune(false);
  }

  function startEdit(sig: SignatureRow) {
    setSelectedUserId(sig.userId);
    setDisplayName(sig.displayName ?? sig.userDisplayName ?? "");
    setPendingFile(null);
    setPendingFileName(null);
    setErr(null);
    setMsg(null);
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!isAcceptedSignatureImageFile(file)) {
      setErr("Formato não suportado. Use PNG, JPEG ou WebP.");
      return;
    }
    setPendingFile(file);
    setPendingFileName(file.name);
    setThreshold(null);
    setContrast(null);
    setShowFineTune(false);
    setErr(null);
    setMsg(null);
  }

  async function saveSignature() {
    if (!selectedUserId) {
      setErr("Seleccione o utilizador a quem atribuir a assinatura.");
      return;
    }
    if (!pendingFile && !editingSignature) {
      setErr("Importe uma imagem da assinatura.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("userId", selectedUserId);
      if (displayName.trim()) fd.append("displayName", displayName.trim());
      if (pendingFile) {
        const opts: SignatureProcessOptions = {};
        if (showFineTune) {
          if (threshold != null) opts.threshold = threshold;
          if (contrast != null) opts.contrast = contrast;
        }
        const { blob } = await processSignatureImageFileDetailed(pendingFile, opts);
        fd.append("file", blob, "assinatura.png");
      }
      const r = await bffFetch("/api/v1/portal/tenant/signatures", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        setErr("Não foi possível guardar a assinatura.");
        return;
      }
      resetForm();
      setCacheBust(Date.now());
      setMsg("Assinatura guardada.");
      await load();
    } catch {
      setErr("Erro ao processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSignature(id: string) {
    if (!window.confirm("Remover esta assinatura?")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await bffFetch(`/api/v1/portal/tenant/signatures/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!r.ok) {
      setErr("Não foi possível remover a assinatura.");
      return;
    }
    if (editingSignature?.id === id) resetForm();
    setCacheBust(Date.now());
    setMsg("Assinatura removida.");
    await load();
  }

  const storedUrl = editingSignature
    ? `${editingSignature.signatureUrl}?v=${cacheBust}`
    : null;
  const displayUrl = previewUrl ?? storedUrl;

  return (
    <section className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Assinaturas da entidade</h2>
        <p className="text-xs text-slate-500 mt-1">
          Atribua uma assinatura PNG a cada utilizador do portal. Quando assinarem sumários ou
          folhas de presença, será usada a respetiva imagem. Importe scan ou PNG transparente - em
          telemóvel o selector de ficheiros também permite usar a câmara. Use{" "}
          <code className="text-slate-400">{`{{entidade.assinatura}}`}</code> nos templates.
        </p>
      </div>

      {err ? <p className="text-xs text-red-300">{err}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      {signatures.length > 0 ? (
        <ul className="space-y-2">
          {signatures.map((sig) => (
            <li
              key={sig.id}
              className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-950/40 p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${sig.signatureUrl}?v=${cacheBust}`}
                alt=""
                className="h-10 w-20 object-contain bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0px] bg-[image:linear-gradient(45deg,#334155_25%,transparent_25%),linear-gradient(-45deg,#334155_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#334155_75%),linear-gradient(-45deg,transparent_75%,#334155_75%)] bg-slate-800 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {sig.userDisplayName ?? sig.displayName ?? "Sem utilizador"}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {sig.userEmail ?? (sig.userId ? sig.userId : "Legado - reatribua a um utilizador")}
                </p>
              </div>
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => startEdit(sig)}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void removeSignature(sig.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Nenhuma assinatura configurada.</p>
      )}

      <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 p-4 space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {editingSignature ? "Actualizar assinatura" : "Nova assinatura"}
        </p>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Utilizador
          </span>
          <select
            value={selectedUserId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedUserId(id);
              const u = users.find((x) => x.id === id);
              setDisplayName(u?.displayName ?? "");
            }}
            disabled={busy || Boolean(editingSignature?.userId)}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          >
            <option value="">Seleccionar utilizador…</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Nome a imprimir (opcional)
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex.: Dr. Ana Costa - Directora"
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          />
        </label>

        <input
          id={uploadInputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          onChange={(e) => {
            const file = takeFileFromInput(e);
            if (file) onPickFile(file);
          }}
        />

        <label
          htmlFor={uploadInputId}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onPickFile(e.dataTransfer.files?.[0]);
          }}
          className={`block rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400/70 bg-blue-950/30"
              : "border-slate-600/50 bg-slate-950/40 hover:border-slate-500/70"
          }`}
        >
          <Upload className="mx-auto h-6 w-6 text-slate-500 mb-1" />
          <p className="text-xs text-slate-200 font-medium">
            Arraste uma imagem ou clique para seleccionar
          </p>
          <p className="text-[10px] text-slate-500 mt-1">PNG, JPEG ou WebP - scan ou PNG transparente</p>
          {pendingFileName ? (
            <p className="text-[10px] text-blue-300 mt-1 truncate">{pendingFileName}</p>
          ) : null}
        </label>

        {pendingFile && alreadyTransparent ? (
          <p className="text-[10px] text-slate-400">PNG já transparente - apenas recorte aplicado.</p>
        ) : null}

        {pendingFile && !alreadyTransparent && autoThreshold != null && autoThreshold >= 0 && !showFineTune ? (
          <p className="text-[10px] text-slate-400">
            Fundo removido (limiar {autoThreshold}). Se necessário, use o ajuste fino.
          </p>
        ) : null}

        {pendingFile && !alreadyTransparent ? (
          <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-2 space-y-2">
            <button
              type="button"
              className="text-[10px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200"
              onClick={() => {
                setShowFineTune((v) => {
                  const next = !v;
                  if (next) {
                    if (threshold == null) {
                      setThreshold(autoThreshold != null && autoThreshold >= 0 ? autoThreshold : 210);
                    }
                    if (contrast == null) setContrast(1.05);
                  }
                  return next;
                });
              }}
            >
              {showFineTune ? "▾ Ocultar ajuste fino" : "▸ Ajuste fino"}
            </button>
            {showFineTune ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[10px] text-slate-500">Limiar {threshold ?? autoThreshold ?? 210}</span>
                  <input
                    type="range"
                    min={140}
                    max={250}
                    value={threshold ?? (autoThreshold != null && autoThreshold >= 0 ? autoThreshold : 210)}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-slate-500">
                    Contraste {(contrast ?? 1.05).toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={135}
                    value={Math.round((contrast ?? 1.05) * 100)}
                    onChange={(e) => setContrast(Number(e.target.value) / 100)}
                    className="w-full accent-blue-500"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className="rounded-lg border border-slate-700/40 p-3 min-h-[88px] flex flex-col items-center justify-center gap-1"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
            backgroundColor: "#1e293b",
          }}
        >
          {displayUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="Pré-visualização" className="max-h-20 max-w-full object-contain" />
              {displayName.trim() ? (
                <p className="text-[10px] text-slate-200 border-t border-slate-500/60 pt-1 px-2 text-center">
                  {displayName.trim()}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[10px] text-slate-500">Pré-visualização</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || !selectedUserId || (!pendingFile && !editingSignature)}
            onClick={() => void saveSignature()}
          >
            Guardar assinatura
          </Button>
          {editingSignature || selectedUserId ? (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
