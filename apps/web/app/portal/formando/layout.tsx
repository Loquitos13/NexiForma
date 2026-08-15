import { Suspense } from "react";
import { FormandoNav } from "@/components/formando/formando-nav";
import { FormandoPwaInstall } from "@/components/formando/formando-pwa-install";
import { FormandoPwaRegister } from "@/components/formando/pwa-register";

export default function FormandoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FormandoPwaRegister />
      <FormandoPwaInstall />
      <Suspense fallback={null}>
        <FormandoNav />
      </Suspense>
      {children}
    </>
  );
}
