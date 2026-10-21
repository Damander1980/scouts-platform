import Link from "next/link";
import type { ReactNode } from "react";

export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display font-extrabold text-[32px] leading-tight m-0">{title}</h1>
        {sub && <p className="text-[14px] m-0 mt-1 text-smoke">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-bold text-[13px] tracking-widest uppercase m-0 text-smoke">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card text-center text-[15px] text-smoke py-8">{children}</div>;
}

type Tone = "green" | "orange" | "gray" | "red" | "dark";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: "#EEE8D9", fg: "#12355F" },
  orange: { bg: "#FFF6D6", fg: "#5E4400" },
  gray: { bg: "#F8F5EE", fg: "#4B5568" },
  red: { bg: "#FDECEA", fg: "#A52A1C" },
  dark: { bg: "#12355F", fg: "#FFFFFF" },
};
export function Chip({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-bold whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}>{children}</span>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" }) {
  const cls = variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost";
  return <Link href={href} className={`${cls} no-underline`}>{children}</Link>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="card">
      <div className="text-[12px] font-bold tracking-widest uppercase text-forest">{label}</div>
      <div className="font-display font-extrabold text-[30px] leading-tight mt-1" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

export function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", opts);
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-bold text-[14px]">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-smoke">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl px-4 py-3 text-[14px] font-bold" style={{ background: "#FFF6D6", color: "#5E4400" }}>{children}</div>;
}
