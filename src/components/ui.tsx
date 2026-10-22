import Link from "next/link";
import type { ReactNode } from "react";

// Page heading with the trail blaze: a short gold stripe, like the paint marks on trail trees.
export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <span aria-hidden="true" className="block w-9 h-[5px] rounded-full mb-3" style={{ background: "linear-gradient(90deg, #F5B700 0 70%, #12355F 70%)" }} />
        <h1 className="font-display font-extrabold text-[34px] md:text-[38px] leading-[1.05] tracking-[-0.02em] m-0">{title}</h1>
        {sub && <p className="text-[15px] m-0 mt-1.5 text-smoke">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="eyebrow m-0 text-forest flex items-center gap-2.5">
        <span aria-hidden="true" className="w-2 h-2 rotate-45 bg-orange flex-none" />{children}
      </h2>
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-sage/70 min-w-[24px]" />
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card text-center text-[15px] text-smoke py-10 flex flex-col items-center gap-3">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="20" stroke="#AEB9C9" strokeDasharray="3 3" />
        <path d="M22 9l3.5 13L22 35l-3.5-13z" fill="#F5B700" /><path d="M22 22l3.5 0L22 35z" fill="#12355F" />
      </svg>
      <div>{children}</div>
    </div>
  );
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
    <div className="card relative overflow-hidden">
      <span aria-hidden="true" className="absolute -right-6 -top-6 w-20 h-20 rounded-full border-[6px] border-mist" />
      <div className="eyebrow text-forest relative">{label}</div>
      <div className="font-display font-extrabold text-[34px] tracking-[-0.02em] leading-tight mt-1.5 relative" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

export function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

// Servers run on UTC, so dates are always shown in the unit's time zone (Central for the pilot;
// set NEXT_PUBLIC_TIME_ZONE to change it). Same zone on server and browser, so no hydration mismatch.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Chicago";

// A plain calendar date ("2026-11-01": due dates, form expiry, YPT) is the same day everywhere, so it
// is shown as-is; reading it as UTC midnight would show the day before in US time zones.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: DATE_ONLY.test(iso) ? "UTC" : TIME_ZONE, ...opts });
}

// A calendar date (YYYY-MM-DD) in the unit's time zone; toISOString() would give tomorrow after 7pm Central.
export function isoDay(d: Date = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Date and time in the unit's time zone, for "when" stamps (sent, synced, published).
export function fmtStamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

// Day of the month in the unit's time zone (instead of Date#getDate, which uses the server's zone).
export function dayOfMonth(iso: string) {
  return Number(new Date(iso).toLocaleDateString("en-US", { day: "numeric", timeZone: TIME_ZONE }));
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

// Wall-clock time in the unit's zone, as a datetime-local value ("2026-10-23T19:00"), whatever zone the device is in.
export function toZonedInput(iso: string | null) {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// A datetime-local value read as the unit's wall-clock time, back to a UTC instant (DST-safe).
export function fromZonedInput(v: string) {
  if (!v) return null;
  const [d, t] = v.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = (t ?? "00:00").split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  let utc = wall;
  for (let i = 0; i < 2; i++) {
    const seen = toZonedInput(new Date(utc).toISOString());
    const [sd, st] = seen.split("T");
    const [sy, smo, sda] = sd.split("-").map(Number);
    const [sh, smi] = st.split(":").map(Number);
    utc += wall - Date.UTC(sy, smo - 1, sda, sh, smi);
  }
  return new Date(utc).toISOString();
}
