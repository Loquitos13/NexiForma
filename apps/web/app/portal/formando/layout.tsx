import { FormandoPwaInstall } from "@/components/formando/formando-pwa-install";
import { FormandoPwaRegister } from "@/components/formando/pwa-register";
import { FormandoPushRegister } from "@/components/formando/formando-push-register";

export default function FormandoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FormandoPwaRegister />
      <FormandoPushRegister />
      <FormandoPwaInstall />
      {children}
    </>
  );
}
