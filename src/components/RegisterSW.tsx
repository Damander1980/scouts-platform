"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Offline trip sheets and attendance hold kids' details: drop them whenever the signed-in person
    // changes or the session ends, not only on the Sign out button (shared family phones).
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? "";
      let last = "";
      try { last = localStorage.getItem("sw-user") ?? ""; localStorage.setItem("sw-user", uid); } catch {}
      if (last && last !== uid) navigator.serviceWorker.controller?.postMessage("clear-private");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
