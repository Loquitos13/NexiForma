import type { Metadata } from "next";
import { APP_NAME } from "@nexiforma/shared";

export const metadata: Metadata = {
  title: `Entrar | ${APP_NAME}`,
  description: "Autenticação segura para entidades formadoras e operação da plataforma NexiForma.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
