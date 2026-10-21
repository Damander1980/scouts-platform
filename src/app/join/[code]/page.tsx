import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function JoinLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("lookup_org", { p_code: code });
  const org = (data as { name: string; city: string | null; state: string | null }[] | null)?.[0];
  const { data: { user } } = await supabase.auth.getUser();
  const next = `/welcome?code=${encodeURIComponent(code)}`;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <div className="bg-forest text-white px-5 pt-14 pb-8">
        <div className="max-w-md mx-auto">
          <div className="text-[12px] font-bold tracking-widest uppercase" style={{ color: "#AEB9C9" }}>You&apos;re invited</div>
          <h1 className="font-display font-extrabold text-[32px] leading-tight m-0 mt-1">{org ? `Join ${org.name}` : "Join a troop"}</h1>
          {org && <p className="m-0 mt-1" style={{ color: "#D7E0EE" }}>{[org.city, org.state].filter(Boolean).join(", ")}</p>}
        </div>
      </div>
      <div className="max-w-md mx-auto w-full px-4 py-8 flex flex-col gap-4">
        {!org && <div className="card">That invite link isn&apos;t valid. Ask your leader for a new one.</div>}
        {org && (
          <>
            <ol className="card flex flex-col gap-2 m-0 pl-8 text-[15px]">
              <li>Create an account with your email and a password, or use Google.</li>
              <li>Add your kids.</li>
              <li>Request to join. A leader approves you.</li>
            </ol>
            <Link href={user ? next : `/login?next=${encodeURIComponent(next)}`} className="btn-primary no-underline">
              {user ? "Continue" : "Sign in to join"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
