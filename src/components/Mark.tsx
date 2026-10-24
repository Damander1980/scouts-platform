import { compassRose } from "./compass";

// Brand mark: a round embroidered patch (gold twill, stitched edge) with a compass rose, north in navy.
// Our own mark, not a Scouting America one.
export default function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="flex-none" aria-hidden="true">
      <circle cx="20" cy="20" r="19.5" fill="#0C2442" />
      <circle cx="20" cy="20" r="17" fill="#F5B700" />
      <circle cx="20" cy="20" r="14.6" fill="none" stroke="#0C2442" strokeWidth="1" strokeDasharray="2 1.6" opacity=".55" />
      {compassRose(0.86).map((s, i) => <path key={i} d={s.d} fill={s.fill} />)}
      <circle cx="20" cy="20" r="1.6" fill="#F5B700" stroke="#0C2442" strokeWidth="0.8" />
    </svg>
  );
}
