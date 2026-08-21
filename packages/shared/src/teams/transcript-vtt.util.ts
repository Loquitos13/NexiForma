/** Converte WebVTT (Graph Teams transcript) em texto legível. */
export function parseVttToPlainText(vtt: string): string {
  const lines = vtt.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let lastSpeaker = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || line.startsWith("NOTE")) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\d{2}:\d{2}:\d{2}/.test(line) && line.includes("-->")) continue;

    const speakerMatch = line.match(/^<v\s+([^>]+)>(.*)<\/v>$/i);
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      if (text) {
        if (speaker !== lastSpeaker) {
          out.push(`${speaker}: ${text}`);
          lastSpeaker = speaker;
        } else {
          out[out.length - 1] = `${out[out.length - 1]} ${text}`;
        }
      }
      continue;
    }

    const tagged = line.replace(/<[^>]+>/g, "").trim();
    if (tagged) out.push(tagged);
  }

  return out.join("\n").trim();
}

export type TeamsTranscricaoEstado = "PENDENTE" | "DISPONIVEL" | "INDISPONIVEL" | "ERRO";

export const TEAMS_TRANSCRICAO_ESTADOS: TeamsTranscricaoEstado[] = [
  "PENDENTE",
  "DISPONIVEL",
  "INDISPONIVEL",
  "ERRO",
];
