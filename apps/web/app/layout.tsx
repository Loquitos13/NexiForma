import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./ui-themes.css";
import { APP_NAME } from "@nexiforma/shared";
import { NexiGuia } from "@/components/guide/nexi-guia";
import { AppProviders } from "@/components/ui/app-providers";

/** Boot: usa cache local do tema (se existir); senão meia-noite. /auth/me confirma a seguir. */
const UI_THEME_BOOT =
  "(function(){try{var d=document.documentElement;var t=localStorage.getItem('nexiforma.uiTheme');var light={};light['snow-azure']=1;light['snow-rose']=1;light['snow-emerald']=1;light['snow-amber']=1;light['snow-violet']=1;var ok={midnight:1,graphite:1,'violet-night':1,ocean:1,forest:1,'snow-azure':1,'snow-rose':1,'snow-emerald':1,'snow-amber':1,'snow-violet':1};if(t&&ok[t]){d.setAttribute('data-ui-theme',t);d.setAttribute('data-ui-scheme',light[t]?'light':'dark');}else{d.setAttribute('data-ui-theme','midnight');d.setAttribute('data-ui-scheme','dark');}}catch(e){}})();";

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
    <html
      lang="pt"
      data-scroll-behavior="smooth"
      data-ui-theme="midnight"
      data-ui-scheme="dark"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script id="ui-theme-boot" strategy="beforeInteractive">
          {UI_THEME_BOOT}
        </Script>
        <AppProviders>
          {children}
          <NexiGuia />
        </AppProviders>
      </body>
    </html>
  );
}
