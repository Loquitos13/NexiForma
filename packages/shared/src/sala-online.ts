export type SalaProvider = "ZOOM" | "TEAMS";

export type SalaOnline = {
  provider: SalaProvider;
  joinUrl: string;
};

/** joinWebUrl real do Graph inclui thread/context; URLs inventadas não. */
export function isLikelyRealTeamsJoinUrl(url: string): boolean {
  return (
    url.includes("@thread.v2") ||
    url.includes("%3ameeting_") ||
    url.includes("%3Ameeting_") ||
    url.includes("context=")
  );
}

export function isLegacyFakeTeamsUrl(url: string): boolean {
  if (!url.includes("teams.microsoft.com/l/meetup-join/")) return false;
  return !isLikelyRealTeamsJoinUrl(url);
}

export function normalizeSalaJoinUrl(url: string): string {
  if (isLegacyFakeTeamsUrl(url)) return url;
  return url;
}

export function resolveSalaOnline(sessao: {
  salaJoinUrl?: string | null;
  zoomMeetingId?: string | null;
  teamsMeetingId?: string | null;
}): SalaOnline | null {
  if (sessao.salaJoinUrl?.startsWith("http")) {
    if (isLegacyFakeTeamsUrl(sessao.salaJoinUrl)) return null;
    const provider: SalaProvider =
      sessao.salaJoinUrl.includes("teams.microsoft.com") || sessao.teamsMeetingId
        ? "TEAMS"
        : "ZOOM";
    return { provider, joinUrl: sessao.salaJoinUrl };
  }

  if (sessao.teamsMeetingId) {
    if (sessao.teamsMeetingId.startsWith("demo-") || sessao.teamsMeetingId.startsWith("teams-demo-")) {
      return null;
    }
    return null;
  }

  if (sessao.zoomMeetingId) {
    if (sessao.zoomMeetingId.startsWith("demo-") || sessao.zoomMeetingId.startsWith("zoom-demo-")) {
      return null;
    }
    return {
      provider: "ZOOM",
      joinUrl: `https://zoom.us/j/${encodeURIComponent(sessao.zoomMeetingId)}`,
    };
  }

  return null;
}

export function isModalidadeOnline(modalidade: string): boolean {
  const m = modalidade.toLowerCase();
  return m.includes("learning") || m.includes("online") || m === "e-learning" || m === "b-learning";
}

/** Formações online (e-learning, b-learning, online) usam Microsoft Teams. */
export function providerParaModalidade(_modalidade: string): SalaProvider {
  return "TEAMS";
}
