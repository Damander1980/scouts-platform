import QRCode from "qrcode";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function PrintFlyer({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_campaign", { p_slug: slug });
  const c = (data as { title: string; description: string | null; org_name: string; active: boolean }[] | null)?.[0];
  if (!c) return <div className="p-8">Not found</div>;
  // A closed campaign gets no new flyers: its QR codes would lead donors to a page that can't take gifts.
  if (!c.active) return <div className="p-8">This campaign is closed, so there are no flyers to print. Reopen it to print new ones.</div>;
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const [flyer, tent, sticker] = await Promise.all(["flyer", "tent", "sticker"].map((src) => QRCode.toDataURL(`${origin}/give/${slug}?src=${src}`, { width: 600, margin: 1 })));

  return (
    <div className="bg-white text-ink">
      <style>{`@media print { .no-print { display: none } .page { page-break-after: always } } .page { min-height: 100vh; }`}</style>
      <div className="no-print p-4 flex gap-2 bg-paper"><button className="btn-primary" id="print">Print</button>
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print').onclick=()=>window.print()" }} /></div>

      <section className="page flex flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="text-[20px] font-bold">{c.org_name}</div>
        <h1 className="font-display font-extrabold text-[48px] leading-tight m-0">{c.title}</h1>
        {c.description && <p className="text-[20px] max-w-xl">{c.description}</p>}
        <img src={flyer} alt="QR code" className="w-80 h-80" />
        <div className="text-[22px] font-bold">Scan to give</div>
      </section>

      <section className="page flex flex-col items-center justify-center p-10">
        <div className="grid grid-cols-1 border-2 border-dashed border-sage w-full max-w-2xl">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-8 p-8" style={i === 0 ? { transform: "rotate(180deg)" } : undefined}>
              <img src={tent} alt="QR" className="w-48 h-48" />
              <div><div className="font-display font-extrabold text-[30px]">{c.title}</div><div className="text-[18px]">Scan to support {c.org_name}</div></div>
            </div>
          ))}
        </div>
        <div className="text-[13px] mt-3 text-smoke">Table tent: fold along the middle.</div>
      </section>

      <section className="page p-10">
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 border border-border rounded-xl p-3">
              <img src={sticker} alt="QR" className="w-32 h-32" />
              <div className="text-[12px] font-bold text-center">{c.org_name}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
