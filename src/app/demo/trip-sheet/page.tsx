// Sample data only: the printable trip sheet a leader takes to a campout.
const youth = [["Emma Chen", "Eagles", "On file", "Peanut allergy"], ["Jake Garcia", "Eagles", "On file", ""], ["Liam Patel", "Wolves", "Needed", "Vegetarian"]];
const adults = [["Floyd Kobler", "Yes (2027-03-01)", "On file", "4"], ["Dana Brooks", "Yes (2026-11-15)", "On file", "3"]];
const cell = "border px-2 py-1 text-left";
const bd = { borderColor: "#DDD6C5" };

export default function DemoTripSheet() {
  return (
    <div className="bg-white text-ink min-h-screen p-4 max-w-3xl mx-auto flex flex-col gap-4 text-[14px]">
      <div>
        <div className="font-bold text-smoke">Troop 999</div>
        <h1 className="font-display font-extrabold text-[26px] m-0">Trip sheet: Caprock Canyon Campout</h1>
        <div>Fri, Oct 30, 5:00 PM to Sun, Nov 1, 12:00 PM</div>
        <div>Caprock Canyons State Park</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["Scouts", "3"], ["Adults", "2"], ["Seats offered", "7 / 5"], ["Two-deep", "Yes"]].map(([l, v]) => (
          <div key={l} className="card"><div className="eyebrow text-smoke">{l}</div><div className="font-extrabold text-[22px]" style={{ color: l === "Two-deep" ? "#12355F" : undefined }}>{v}</div></div>
        ))}
      </div>
      <section className="overflow-x-auto">
        <h2 className="font-bold text-[16px] mb-1">Scouts going</h2>
        <table className="w-full border-collapse"><thead><tr>{["Name", "Patrol", "Health A+B", "Diet"].map((h) => <th key={h} className={cell} style={bd}>{h}</th>)}</tr></thead>
          <tbody>{youth.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={cell} style={{ ...bd, color: c === "Needed" ? "#A52A1C" : undefined, fontWeight: c === "Needed" ? 700 : undefined }}>{c}</td>)}</tr>)}</tbody></table>
      </section>
      <section className="overflow-x-auto">
        <h2 className="font-bold text-[16px] mb-1">Adults going</h2>
        <table className="w-full border-collapse"><thead><tr>{["Name", "YPT through trip", "Health A+B", "Seats"].map((h) => <th key={h} className={cell} style={bd}>{h}</th>)}</tr></thead>
          <tbody>{adults.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={cell} style={bd}>{c}</td>)}</tr>)}</tbody></table>
      </section>
      <section>
        <h2 className="font-bold text-[16px] mb-1">SAFE checklist</h2>
        {["[x] Supervision: two registered adults with current YPT", "[x] Assessment: site hazards reviewed", "[ ] Fitness: health forms checked (1 missing)", "[x] Equipment: gear checked out", "[ ] Environment: weather checked the day before"].map((t) => <div key={t}>{t}</div>)}
      </section>
      <div className="text-[12px] text-smoke">Completed health forms stay on paper with the designated leader. This sheet shows status only.</div>
    </div>
  );
}
