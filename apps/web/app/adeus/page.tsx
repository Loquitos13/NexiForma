"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  SessionGoodbyeSkeleton,
  SessionGoodbyeView,
  type SessionGoodbyeReason,
} from "@/components/site/session-goodbye";
import { resetSessionRedirectGuard } from "@/lib/client/session-lifecycle";

function AdeusContent() {
  const params = useSearchParams();
  const reason: SessionGoodbyeReason =
    params.get("reason") === "logout" ? "logout" : "expired";
  const next = params.get("next")?.trim() || "/portal";

  useEffect(() => {
    resetSessionRedirectGuard();
  }, []);

  return <SessionGoodbyeView reason={reason} returnTo={next} />;
}

export default function AdeusPage() {
  return (
    <Suspense fallback={<SessionGoodbyeSkeleton />}>
      <AdeusContent />
    </Suspense>
  );
}
