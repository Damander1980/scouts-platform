"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SiteData = {
  org: {
    id: string; name: string; type: string; unit_number: string | null; city: string | null; state: string | null; slug: string; join_code: string;
    site: { brand_color?: string; logo_path?: string; banner_path?: string; welcome_title?: string; welcome_text?: string; about?: string; facebook_url?: string; meeting_info?: string; chartered_org?: string };
  };
  contacts: { title: string; person_id: string; name: string }[];
  events: { id: string; title: string; start_at: string; end_at: string | null; kind: string; deadline: string | null; location: string | null }[];
  albums: { id: string; title: string; taken_on: string | null; photos: { path: string; caption: string | null }[] }[];
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function TroopPageClient({ data, storageUrl, menu = [] }: { data: SiteData; storageUrl: string; menu?: { slug: string; title: string }[] }) {
  const { org, contacts, events, albums } = data;
  const site = org.site ?? {};
  const word = "Troop";
  const brand = site.brand_color && /^#[0-9a-f]{6}$/i.test(site.brand_color) ? site.brand_color : "#12355F";
  const [contactTo, setContactTo] = useState<string>(contacts[0]?.person_id ?? "");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ album: number; i: number } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await createClient().rpc("submit_contact", {
      p_slug: org.slug, p_to: contactTo || null, p_name: form.name, p_email: form.email, p_phone: form.phone, p_message: form.message,
    });
    if (error) setError(error.message); else setSent(true);
  }

  const groupedContacts = contacts.reduce<Record<string, typeof contacts>>((a, c) => ({ ...a, [c.title]: [...(a[c.title] ?? []), c] }), {});

  return (
    <div className="min-h-screen" style={{ background: "#FBFAF5", color: "#101B2D" }}>
      <header style={{ background: brand }} className="text-white">
        {site.banner_path ? (
          <img src={storageUrl + site.banner_path} alt={org.name} className="w-full max-h-[260px] object-cover" />
        ) : (
          <div className="max-w-6xl mx-auto px-4 py-8 flex items-center gap-4">
            {site.logo_path && <img src={storageUrl + site.logo_path} alt="" className="w-20 h-20 rounded-full bg-white object-contain" />}
            <div>
              <div className="font-display font-extrabold text-[36px] leading-none">{word} {org.unit_number}</div>
              <div className="text-[16px] opacity-90">{[org.city, org.state].filter(Boolean).join(", ")}</div>
            </div>
          </div>
        )}
        <nav className="bg-black/15">
          <div className="max-w-6xl mx-auto px-4 h-11 flex items-center gap-5 text-[14px] font-bold overflow-x-auto whitespace-nowrap">
            <a href="#welcome" className="text-white no-underline">Home</a>
            <a href="#events" className="text-white no-underline">Calendar</a>
            <a href="#photos" className="text-white no-underline">Photos</a>
            {menu.map((m) => <a key={m.slug} href={`/${org.slug}/${m.slug}`} className="text-white no-underline">{m.title}</a>)}
            <a href="#contact" className="text-white no-underline">Contact</a>
            <a href={`/join/${org.slug}`} className="ml-auto px-4 py-1.5 rounded-full no-underline" style={{ background: "#F5B700", color: "#101B2D" }}>Join us</a>
            <a href="/login" className="text-white no-underline opacity-80">Member sign in</a>
          </div>
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_220px_280px] gap-8">
        <main className="flex flex-col gap-6 min-w-0">
          <section id="welcome" className="flex flex-col gap-3">
            <h1 className="font-display font-bold text-[34px] leading-tight m-0">{site.welcome_title || `Welcome to ${word} ${org.unit_number}!`}</h1>
            <p className="text-[16px] leading-relaxed m-0 whitespace-pre-wrap">
              {site.welcome_text || `${org.name} is a Scouting America unit in ${org.city ?? "our community"}. New families are always welcome.`}
            </p>
            {site.meeting_info && <p className="text-[16px] m-0"><b>We meet:</b> {site.meeting_info}</p>}
          </section>

          {site.facebook_url && /^https:\/\/(www\.)?facebook\.com\//.test(site.facebook_url) && (
            <div className="border-y border-[#E6E2D3] py-5 text-center">
              <span className="font-display font-bold text-[26px]">Follow us on <a href={site.facebook_url} target="_blank" rel="noopener noreferrer" style={{ color: "#1877F2" }} className="no-underline">Facebook</a></span>
            </div>
          )}

          {contacts.length > 0 && (
            <section id="contact" className="flex flex-col gap-3">
              <p className="font-bold m-0">Questions about our {word.toLowerCase()}? Send a message to:</p>
              <div className="grid gap-1 text-[15px]">
                {Object.entries(groupedContacts).map(([title, list]) => (
                  <div key={title} className="flex gap-2 flex-wrap">
                    <b>{title}:</b>
                    {list.map((c) => (
                      <button key={c.person_id} onClick={() => { setContactTo(c.person_id); document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" }); }}
                        className="bg-transparent border-0 p-0 cursor-pointer font-sans text-[15px] underline" style={{ color: "#1F5F9F" }}>{c.name}</button>
                    ))}
                  </div>
                ))}
              </div>
              <form id="contact-form" onSubmit={send} className="rounded-2xl border border-[#E6E2D3] bg-white p-4 flex flex-col gap-3">
                {sent ? <div className="font-bold">Thanks! A leader will get back to you soon.</div> : (
                  <>
                    <select className="input" value={contactTo} onChange={(e) => setContactTo(e.target.value)}>
                      {contacts.map((c) => <option key={c.person_id} value={c.person_id}>{c.title}: {c.name}</option>)}
                    </select>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input aria-label="Your name" className="input" placeholder="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <input aria-label="Your email" className="input" type="email" placeholder="Your email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <textarea className="input py-3 min-h-[100px]" placeholder="Your message" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                    {error && <div className="text-[14px] font-bold" style={{ color: "#A52A1C" }}>{error}</div>}
                    <button className="btn-primary self-start">Send message</button>
                  </>
                )}
              </form>
            </section>
          )}

          <section className="flex flex-col gap-3 border-t border-[#E6E2D3] pt-6">
            <h2 className="font-display font-bold text-[28px] text-center m-0">About Our {word}</h2>
            <div className="text-[16px] leading-relaxed whitespace-pre-wrap">
              {site.about || `The mission of Scouting America is to prepare young people to make ethical and moral choices over their lifetimes by instilling in them the values of the Scout Oath and Scout Law.`}
            </div>
            {site.chartered_org && <p className="m-0 text-[15px]"><b>Chartered organization:</b> {site.chartered_org}</p>}
            <a href={`/join/${org.slug}`} className="btn-primary no-underline self-start">Interested? Join us</a>
          </section>
        </main>

        <aside id="photos" className="flex flex-col gap-4">
          {albums.map((a, ai) => a.photos.length > 0 && (
            <button key={a.id} onClick={() => setLightbox({ album: ai, i: 0 })} className="bg-transparent border-0 p-0 cursor-pointer text-center font-sans">
              <img src={storageUrl + a.photos[0].path} alt={a.title} className="w-full aspect-[4/3] object-cover rounded-lg" loading="lazy" />
              <div className="text-[14px] mt-1" style={{ color: "#1F5F9F" }}>{a.title}{a.taken_on ? ` (${new Date(a.taken_on).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })})` : ""}</div>
            </button>
          ))}
        </aside>

        <aside id="events" className="flex flex-col gap-4 text-center">
          <h2 className="font-display font-bold text-[24px] italic m-0">Upcoming Events</h2>
          {events.length === 0 && <div className="text-smoke">Check back soon.</div>}
          {events.map((e) => (
            <div key={e.id} className="flex flex-col">
              <a href={`/events/${e.id}`} className="font-bold no-underline" style={{ color: e.deadline ? "#1E8A3E" : "#1F5F9F" }}>{e.title}</a>
              <span className="text-[14px]">({fmt(e.start_at)})</span>
              {e.deadline && <span className="text-[14px]">Sign up by {new Date(e.deadline).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>}
            </div>
          ))}
        </aside>
      </div>

      <footer className="border-t border-[#E6E2D3] py-6 text-center text-[13px] text-smoke">
        {org.name} · Powered by ScoutPlatform · Not affiliated with Scouting America
      </footer>

      {lightbox && (() => {
        const a = albums[lightbox.album]; const ph = a.photos[lightbox.i];
        return (
          <div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-4 gap-3" onClick={() => setLightbox(null)}>
            <img src={storageUrl + ph.path} alt={ph.caption ?? a.title} className="max-h-[80vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
            <div className="text-white text-[15px]">{ph.caption ?? a.title} · {lightbox.i + 1} / {a.photos.length}</div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button className="btn-secondary" disabled={lightbox.i === 0} onClick={() => setLightbox({ ...lightbox, i: lightbox.i - 1 })}>Previous</button>
              <button className="btn-secondary" disabled={lightbox.i === a.photos.length - 1} onClick={() => setLightbox({ ...lightbox, i: lightbox.i + 1 })}>Next</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
