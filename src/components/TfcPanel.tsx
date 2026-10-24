import type { Tfc } from "@/lib/tfc";
import { fmtDate } from "@/components/ui";
import { videoSearch } from "@/lib/skillTopics";

export type Coming = { date: string; title: string; notes: string | null; links: { label: string; url: string }[];
  reqs: { id: string; label: string; text: string; status: "done" | "waiting" | "todo" }[] };
const safeUrl = (u: string) => /^https?:\/\//i.test(u);

const short = (t: string) => (t.length > 150 ? `${t.slice(0, 147).trimEnd()}…` : t);

// A new Scout's view of the Trail to First Class: how far along, and what to work on next, in plain words.
export default function TfcPanel({ tfc, coming = [], firstName, self }: { tfc: Tfc; coming?: Coming[]; firstName: string; self: boolean }) {
  if (!tfc.ranks.length || tfc.finished) return null;
  const pct = tfc.total ? Math.round((tfc.done / tfc.total) * 100) : 0;
  return (
    <section className="patch !rounded-[20px] !p-6 flex flex-col gap-5 mb-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow" style={{ color: "#F5B700" }}>Trail to First Class</div>
          <h2 className="font-display font-extrabold text-[24px] leading-tight m-0">
            {self ? "You're" : `${firstName} is`} {pct}% of the way to First Class
          </h2>
          <div className="text-[14px]" style={{ color: "#D7E0EE" }}>{tfc.done} of {tfc.total} requirements signed off across Scout, Tenderfoot, Second Class and First Class. They can be done in any order.</div>
        </div>
      </div>

      <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.15)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Trail to First Class progress">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#F5B700" }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {tfc.ranks.map((r) => (
          <div key={r.code} className="rounded-xl px-3 py-2.5" style={{ background: r.earned ? "#F5B700" : "rgba(255,255,255,.08)", color: r.earned ? "#101B2D" : "white" }}>
            <div className="font-bold text-[14px]">{r.name}</div>
            <div className="text-[13px]" style={{ color: r.earned ? "#101B2D" : "#D7E0EE" }}>
              {r.earned ? "Earned ✓" : `${r.done}/${r.total} done${r.waiting ? ` · ${r.waiting} waiting` : ""}`}
            </div>
          </div>
        ))}
      </div>

      {coming.map((c) => (
        <div key={c.date + c.title} className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: "#F5B700", color: "#101B2D" }}>
          <div className="eyebrow">Coming up · {fmtDate(c.date + "T12:00:00", { weekday: "long", month: "short", day: "numeric" })}</div>
          <div className="font-display font-extrabold text-[20px] leading-tight">{c.title}</div>
          {c.notes && <div className="text-[14px]">{c.notes}</div>}
          {c.links.filter((l) => safeUrl(l.url)).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {c.links.filter((l) => safeUrl(l.url)).map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="min-h-[40px] px-4 rounded-full font-bold text-[14px] flex items-center no-underline" style={{ background: "#101B2D", color: "white" }}>▶ {l.label}</a>
              ))}
            </div>
          )}
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {c.reqs.map((r) => (
              <li key={r.id} className="flex gap-2 items-start text-[14px] rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.55)" }}>
                <span className="font-bold flex-none" aria-label={r.status}>{r.status === "done" ? "✓" : r.status === "waiting" ? "…" : "○"}</span>
                <span className="flex-1"><b>{r.label}</b> {short(r.text)}{r.status === "done" ? " (done)" : r.status === "waiting" ? " (waiting for sign-off)" : ""}</span>
                {r.status === "todo" && <a href={videoSearch(r.text)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold flex-none" style={{ color: "#12355F" }}>Find a video</a>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {tfc.next.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-[16px]">{self ? "Work on these next" : `What ${firstName} can work on next`}</div>
          <ol className="m-0 p-0 list-none flex flex-col gap-2">
            {tfc.next.map((r) => (
              <li key={r.id} className="rounded-xl px-3 py-2.5 flex gap-3 items-start" style={{ background: "rgba(255,255,255,.08)" }}>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full flex-none mt-0.5" style={{ background: "#F5B700", color: "#101B2D" }}>{r.rankName} {r.number}</span>
                <span className="text-[14px] leading-snug" title={r.text}>{short(r.text)}</span>
              </li>
            ))}
          </ol>
          <div className="text-[13px]" style={{ color: "#D7E0EE" }}>
            {self ? "Done one? Open the rank below, mark it done, and a leader signs it off." : "When it's done, mark it on the rank below and a leader signs it off."}
          </div>
        </div>
      )}
      {tfc.waiting.length > 0 && (
        <div className="text-[14px]" style={{ color: "#D7E0EE" }}>
          <b className="text-white">{tfc.waiting.length} waiting for a leader&apos;s sign-off:</b> {tfc.waiting.slice(0, 6).map((r) => `${r.rankName} ${r.number}`).join(", ")}{tfc.waiting.length > 6 ? "…" : ""}
        </div>
      )}
    </section>
  );
}
