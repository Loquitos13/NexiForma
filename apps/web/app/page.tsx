import { InteractiveBackground } from "@/components/site/interactive-background";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WelcomePageContent } from "@/components/site/welcome-page-content";

export default function HomePage() {
  return (
    <div className="relative isolate min-h-screen flex flex-col">
      <InteractiveBackground variant="welcome" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <WelcomePageContent />
        <SiteFooter />
      </div>
    </div>
  );
}
