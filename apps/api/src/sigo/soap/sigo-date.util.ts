import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/** Data estrita YYYY-MM-DD (sem milissegundos nem fuso Z). */
export function formatSigoDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const d = dayjs.utc(value);
  if (!d.isValid()) return null;
  return d.format("YYYY-MM-DD");
}

/** Data/hora SIGO: YYYY-MM-DDTHH:mm:ss (sem offset). */
export function formatSigoDateTime(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const d = dayjs.utc(value);
  if (!d.isValid()) return null;
  return d.format("YYYY-MM-DDTHH:mm:ss");
}

/** WS-Security Created timestamp (ISO UTC sem ms). */
export function formatWsSecurityCreated(): string {
  return dayjs.utc().format("YYYY-MM-DDTHH:mm:ss") + "Z";
}
