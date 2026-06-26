import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 bg-[#070b12]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full blur-[120px] opacity-30 bg-gradient-to-b from-blue-600/40 via-blue-900/15 to-transparent" />
      </div>

      <div className="relative w-full max-w-[440px] z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-black text-white bg-gradient-to-br from-blue-600 to-teal-600 ring-1 ring-blue-500/30">
            N
          </span>
          <span className="text-base font-bold text-slate-100">NexiForma</span>
        </Link>

        <div className="rounded-2xl border border-slate-700/30 bg-[#0f172a]/90 shadow-2xl p-7">
          <div className="text-5xl font-black text-slate-600 mb-3">404</div>
          <h1 className="text-xl font-bold text-slate-50 mb-2">Pagina nao encontrada</h1>
          <p className="text-sm text-slate-400 mb-5">
            O endereco que procuras nao existe ou foi movido.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
