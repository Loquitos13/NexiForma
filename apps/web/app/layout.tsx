import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@nexiforma/shared";
import { NexiGuia } from "@/components/guide/nexi-guia";
import { AppProviders } from "@/components/ui/app-providers";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Plataforma SaaS para entidades formadoras certificadas DGERT – dossie pedagogico digital, LMS, assiduidade e compliance.",
  keywords: ["DGERT", "formacao certificada", "dossie pedagogico", "LMS", "SIGO", "Portugal"],
  authors: [{ name: APP_NAME }],
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: APP_NAME },
  openGraph: {
    title: APP_NAME,
    description: "Gestao formativa certificada – dossie, LMS e multi-tenant.",
    locale: "pt_PT",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070b12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" data-scroll-behavior="smooth">
      <body>
        <AppProviders>
          {children}
          <NexiGuia />
        </AppProviders>
      </body>
    </html>
  );
}
