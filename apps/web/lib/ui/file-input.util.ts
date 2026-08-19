import type { ChangeEvent } from "react";

/** Copia ficheiros do input antes de o resetar (FileList é live e fica vazio). */
export function takeFilesFromInput(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(event.currentTarget.files ?? []);
  event.currentTarget.value = "";
  return files;
}

export function takeFileFromInput(event: ChangeEvent<HTMLInputElement>): File | null {
  const file = event.currentTarget.files?.[0] ?? null;
  event.currentTarget.value = "";
  return file;
}
