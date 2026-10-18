"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Landing page for emailed sign-in links. Handles the implicit flow (tokens in the URL
// hash, works in any browser) and the token_hash flow (if the email template uses it).
export default function ConfirmPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const rawNext = url.searchParams.get("next") || "/home";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/home";
    const tokenHash = url.searchParams.get("token_hash");
    const type = (url.searchParams.get("type") || "email") as "email" | "magiclink" | "signup";
    const hash = new URLSearchParams(window.location.hash.slice(1));

    (async () => {
      try {
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!,
            refresh_token: hash.get("refresh_token")!,
          });
          if (error) throw error;
        } else if (hash.get("error_description")) {
          throw new Error(hash.get("error_description")!);
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("That link has expired. Request a new one.");
        router.replace(next);
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Sign-in failed");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 text-center">
      <div className="flex flex-col gap-3">
        <p className="font-bold text-[17px]">{msg}</p>
        {msg !== "Signing you in…" && <a href="/login" className="text-forest font-bold underline">Back to sign in</a>}
      </div>
    </div>
  );
}
