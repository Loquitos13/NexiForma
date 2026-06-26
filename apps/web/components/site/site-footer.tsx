import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-700/30 bg-[#070b12]/95">
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 mb-5">
          <div>
            <p className="font-semibold text-slate-200 text-sm mb-1">NexiForma</p>
            <p className="text-xs text-slate-500">Gestão formativa certificada para entidades DGERT</p>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <Link href="/login" className="text-slate-400 hover:text-slate-200 transition-colors">
              Entrar
            </Link>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-700/20 text-xs text-slate-600">
          &copy; {year} NexiForma. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
