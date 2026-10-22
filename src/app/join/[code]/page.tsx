import Link from "next/link";
import Mark from "@/components/Mark";
import { createClient } from "@/lib/supabase/server";

export default async function JoinLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("lookup_org", { p_code: code });
  const org = (data as { name: string; city: string | null; state: string | null }[] | null)?.[0];
  const { data: { user } } = await supabase.auth.getUser();
  const next = `/welcome?code=${encodeURIComponent(code)}`;

  const steps = ["Create an account with your email and a password, or use Google.", "Add your kids. Scouts under 13 get an account only with your consent.", "Ask to join. A leader approves you."];
  const login = (mode: string) => `/login?mode=${mode}&next=${encodeURIComponent(next)}`;

  return (
    <div className="min-h-screen bg-canvas flex flex-col sm:py-10 px-0 sm:px-4">
      <div className="w-full max-w-xl mx-auto bg-white sm:rounded-[20px] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(16,27,45,.06), 0 14px 36px rgba(16,27,45,.12)" }}>
        <div className="bg-forest text-white px-7 pt-8 pb-7">
          <div className="flex items-center gap-2.5 mb-5">
            <Mark size={32} />
            <span className="font-display font-extrabold text-[17px]">ScoutPlatform</span>
          </div>
          <div className="text-[12px] font-bold tracking-widest uppercase" style={{ color: "#F5B700" }}>You&apos;re invited</div>
          <h1 className="font-display font-extrabold text-[34px] leading-tight m-0 mt-1">{org ? `Join ${org.name}` : "Join a troop"}</h1>
          {org && <p className="m-0 mt-1" style={{ color: "#D7E0EE" }}>{[org.city, org.state].filter(Boolean).join(", ")}</p>}
        </div>
        <div className="px-7 py-7 flex flex-col gap-5">
          {!org && <p className="m-0 text-[15px]">That invite link isn&apos;t valid. Ask your leader for a new one.</p>}
          {org && (
            <>
              <ol className="m-0 p-0 list-none flex flex-col gap-4">
                {steps.map((t, i) => (
                  <li key={t} className="flex gap-3 items-start text-[15px]">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center font-display font-extrabold text-[14px] flex-none text-white" style={{ background: "#12355F" }}>{i + 1}</span>
                    <span className="pt-1">{t}</span>
                  </li>
                ))}
              </ol>
              {user ? (
                <Link href={next} className="btn-primary no-underline">Continue</Link>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href={login("signup")} className="btn-primary no-underline flex-1">Create an account</Link>
                  <Link href={login("signin")} className="btn-secondary no-underline flex-1">I already have one</Link>
                </div>
              )}
              <p className="text-[13px] text-smoke m-0">No ads, and your family&apos;s information is never sold. <a href="/safety" className="font-bold text-forest">How we protect Scouts&apos; data</a></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
