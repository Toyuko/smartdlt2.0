import { Suspense } from "react";
import { redirect } from "next/navigation";

export const instant = false;

export default function LegacyVerificationPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <LegacyVerificationRedirect params={params} />
    </Suspense>
  );
}

async function LegacyVerificationRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/demo-ticket/${encodeURIComponent(token)}`);
  return null;
}
