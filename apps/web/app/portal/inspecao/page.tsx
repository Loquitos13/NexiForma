import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<{ acao?: string }>;
};

/** Atalho legado — inspeção DGERT vive em /portal/dossie. */
export default async function PortalInspecaoRedirect({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const acao = sp.acao?.trim();
  redirect(acao ? `/portal/dossie?acao=${encodeURIComponent(acao)}` : "/portal/dossie");
}
