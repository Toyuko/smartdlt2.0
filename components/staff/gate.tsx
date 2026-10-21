import { redirect } from "next/navigation";
import { StaffNav } from "@/components/staff/panels";
import { SetupRequired } from "@/components/language";
import { getStaffSession } from "@/lib/auth";

export async function StaffGate({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (session.kind === "setup") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <SetupRequired />
      </main>
    );
  }
  if (session.kind === "anonymous") redirect("/staff/login");
  if (session.kind === "forbidden") redirect("/staff/login?error=not_staff");
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <StaffNav displayName={session.displayName} />
      {children}
    </main>
  );
}
