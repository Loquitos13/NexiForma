"use client";

import { redirect } from "next/navigation";
import { platformAuthHref } from "@/lib/client/platform-auth-mode";

export default function PlataformaForgotRedirect() {
  redirect(platformAuthHref("/login/recuperar"));
}
