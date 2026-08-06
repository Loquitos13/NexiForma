import type { CrmCustomFieldDef, CrmCustomFieldEntity } from "./enterprise-types";

export class CrmCustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmCustomFieldValidationError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function customFieldDefsForEntity(
  defs: CrmCustomFieldDef[],
  entity: CrmCustomFieldEntity,
): CrmCustomFieldDef[] {
  return defs.filter((d) => d.entity === entity && d.key.trim().length > 0);
}

export function validateCustomFieldsForEntity(
  defs: CrmCustomFieldDef[],
  entity: CrmCustomFieldEntity,
  input: unknown,
): Record<string, unknown> {
  const applicable = customFieldDefsForEntity(defs, entity);
  const raw = asRecord(input);
  const out: Record<string, unknown> = {};

  for (const def of applicable) {
    const key = def.key.trim();
    const value = raw[key];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim());

    if (empty) {
      if (def.required) {
        throw new CrmCustomFieldValidationError(`Campo obrigatório: ${def.label || key}.`);
      }
      continue;
    }

    switch (def.type) {
      case "text": {
        if (typeof value !== "string") {
          throw new CrmCustomFieldValidationError(`${def.label}: texto inválido.`);
        }
        out[key] = value.trim();
        break;
      }
      case "number": {
        const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
        if (!Number.isFinite(n)) {
          throw new CrmCustomFieldValidationError(`${def.label}: número inválido.`);
        }
        out[key] = n;
        break;
      }
      case "date": {
        const s = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          throw new CrmCustomFieldValidationError(`${def.label}: data inválida (AAAA-MM-DD).`);
        }
        out[key] = s;
        break;
      }
      case "select": {
        const s = String(value).trim();
        const options = def.options ?? [];
        if (options.length && !options.includes(s)) {
          throw new CrmCustomFieldValidationError(`${def.label}: opção inválida.`);
        }
        out[key] = s;
        break;
      }
      default:
        out[key] = value;
    }
  }

  for (const key of Object.keys(raw)) {
    if (!applicable.some((d) => d.key.trim() === key)) {
      throw new CrmCustomFieldValidationError(`Campo custom desconhecido: ${key}.`);
    }
  }

  return out;
}
