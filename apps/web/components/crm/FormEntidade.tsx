"use client";

import { FormEvent, useState } from "react";
import { bo } from "@/lib/ui/backoffice";

export interface EntidadeFormData {
  nif: string;
  nome: string;
  email?: string;
  telefone?: string;
}

interface FormEntidadeProps {
  initial?: EntidadeFormData;
  onSubmit: (data: EntidadeFormData) => Promise<void>;
  busy?: boolean;
}

export function FormEntidade({ initial, onSubmit, busy = false }: FormEntidadeProps) {
  const [form, setForm] = useState<EntidadeFormData>({
    nif: initial?.nif ?? "",
    nome: initial?.nome ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
  });

  const isEdit = !!initial;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data: EntidadeFormData = {
      nif: form.nif.trim(),
      nome: form.nome.trim(),
      email: form.email?.trim() || undefined,
      telefone: form.telefone?.trim() || undefined,
    };
    await onSubmit(data);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: "0.6rem", maxWidth: 480 }}>
      {!isEdit ? (
        <label style={bo.label}>
          NIF *
          <input
            style={bo.input}
            required
            minLength={9}
            maxLength={9}
            placeholder="500123456"
            value={form.nif}
            onChange={(ev) => setForm((f) => ({ ...f, nif: ev.target.value }))}
          />
        </label>
      ) : null}
      <label style={bo.label}>
        Nome / Razão Social *
        <input
          style={bo.input}
          required
          placeholder="Tech Solutions Portugal"
          value={form.nome}
          onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
        />
      </label>
      <label style={bo.label}>
        Email
        <input
          style={bo.input}
          type="email"
          placeholder="contacto@exemplo.pt"
          value={form.email}
          onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
        />
      </label>
      <label style={bo.label}>
        Telefone
        <input
          style={bo.input}
          type="tel"
          placeholder="+351 21 1234567"
          value={form.telefone}
          onChange={(ev) => setForm((f) => ({ ...f, telefone: ev.target.value }))}
        />
      </label>
      <button type="submit" disabled={busy} style={bo.btn}>
        {isEdit ? "Guardar alterações" : "Criar entidade"}
      </button>
    </form>
  );
}
