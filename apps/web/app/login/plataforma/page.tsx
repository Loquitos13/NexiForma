"use client";

import { redirect } from "next/navigation";
import { platformAuthHref } from "@/lib/client/platform-auth-mode";

export default function PlataformaLoginRedirect() {
  redirect(platformAuthHref("/login"));
}
