import Link from "next/link";
import Mark from "@/components/Mark";

export default function HelpHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-forest text-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 no-underline text-white flex-1">
          <Mark size={36} />
          <span className="hidden sm:inline font-display font-extrabold text-[19px]">Our Troop Manager</span>
        </Link>
        <Link href="/help" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center">Help</Link>
        <Link href="/login" className="text-white font-bold text-[15px] no-underline min-h-[44px] flex items-center whitespace-nowrap">Sign in</Link>
      </div>
      {children}
    </header>
  );
}
