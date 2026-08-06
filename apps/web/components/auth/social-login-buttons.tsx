"use client";

type SocialLoginButtonsProps = {
  slug: string;
  providers: {
    google: boolean;
    microsoft: boolean;
    googleStartUrl: string | null;
    microsoftStartUrl: string | null;
  } | null;
  loading?: boolean;
  disabled?: boolean;
  onError?: (message: string) => void;
  /** Chamado imediatamente antes do redirect para o IdP. */
  onBeforeStart?: () => void;
};

const btnBase =
  "w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50";

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.608 4.608 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.758-5.595-4.123H1.064v2.59A9.996 9.996 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.405 13.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V7.51H1.064A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l5.341-4.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.99 14.695 2 12 2 7.7 2 3.977 4.47 2.064 7.51l5.341 4.59C8.19 9.735 10.395 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export function SocialLoginButtons({
  slug,
  providers,
  loading,
  disabled,
  onError,
  onBeforeStart,
}: SocialLoginButtonsProps) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="A carregar login social">
        <div className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-slate-700/60" />
          <span className="text-xs text-slate-500 uppercase tracking-wide">ou</span>
          <div className="h-px flex-1 bg-slate-700/60" />
        </div>
        <div className={`${btnBase} border-slate-700/40 bg-slate-900/30 text-slate-500 animate-pulse`}>
          A carregar opções de login…
        </div>
      </div>
    );
  }

  if (!providers) return null;
  if (!providers.google && !providers.microsoft) return null;

  function start(url: string | null) {
    if (!url) return;
    try {
      onBeforeStart?.();
      const target = new URL(url);
      if (typeof window !== "undefined" && !target.searchParams.has("return_to")) {
        target.searchParams.set("return_to", window.location.origin);
      }
      const slugValue = slug.trim();
      if (slugValue) {
        target.searchParams.set("slug", slugValue);
      } else {
        target.searchParams.delete("slug");
      }
      window.location.href = target.toString();
    } catch {
      onError?.("Não foi possível iniciar login social.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-700/60" />
        <span className="text-xs text-slate-500 uppercase tracking-wide">ou</span>
        <div className="h-px flex-1 bg-slate-700/60" />
      </div>

      {providers.google ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => start(providers.googleStartUrl)}
          className={`${btnBase} border-slate-600/60 bg-slate-900/50 text-slate-100 hover:bg-slate-800/80`}
        >
          <GoogleIcon />
          Continuar com Google
        </button>
      ) : null}

      {providers.microsoft ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => start(providers.microsoftStartUrl)}
          className={`${btnBase} border-slate-600/60 bg-slate-900/50 text-slate-100 hover:bg-slate-800/80`}
        >
          <MicrosoftIcon />
          Continuar com Microsoft
        </button>
      ) : null}
    </div>
  );
}
