// Brand mark: a navy mountain range on a gold tile (ties to the topo theme; not a Scouting America mark).
export default function Mark({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center flex-none" style={{ width: size, height: size, borderRadius: size * 0.28, background: "#F5B700" }} aria-hidden="true">
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
        <path d="M2 19.5 8.6 8.2l3.6 6 2.4-3.6 7.4 8.9z" fill="#12355F" />
        <path d="M8.6 8.2 10.7 11.7 9.4 11 8.1 12.1 7 11z" fill="#FFFFFF" />
      </svg>
    </span>
  );
}
