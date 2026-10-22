// Brand mark: a round embroidered patch (gold twill, stitched edge) with a navy peak and a trail
// switchbacking up it. Our own mark, not a Scouting America one.
export default function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="flex-none" aria-hidden="true">
      <circle cx="20" cy="20" r="19.5" fill="#0C2442" />
      <circle cx="20" cy="20" r="17" fill="#F5B700" />
      <circle cx="20" cy="20" r="14.6" fill="none" stroke="#0C2442" strokeWidth="1" strokeDasharray="2 1.6" opacity=".55" />
      <path d="M7.5 27 16 13.5l4.2 6.4 3-4.2L32.5 27z" fill="#12355F" />
      <path d="M16 13.5 18.4 17.2 16.9 16.5 15.4 17.6 14.2 16.4z" fill="#FFFFFF" />
      <path d="M20 27c-2.4-1.2 1.6-2.4-.6-3.6s2.2-2 .4-3" fill="none" stroke="#F5B700" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.4 1.2" />
    </svg>
  );
}
