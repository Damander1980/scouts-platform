import { TIME_ZONE } from "@/components/ui";
// Block types for website builder pages, and the renderer shared by the public page and
// the editor preview. No hooks, so it renders on the server or the client.

export type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; path: string; caption?: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "video"; url: string }
  | { id: string; type: "map"; address: string }
  | { id: string; type: "events" }
  | { id: string; type: "album"; album_id: string }
  | { id: string; type: "join" };

export const BLOCK_LABELS: Record<Block["type"], string> = {
  heading: "Heading", text: "Text", image: "Image", button: "Button", video: "Video link",
  map: "Map", events: "Upcoming events", album: "Photo album", join: "Join us button",
};

export type BlockData = {
  brand: string;
  storageUrl: string;
  joinHref: string;
  events: { id: string; title: string; start_at: string; location: string | null }[];
  albums: { id: string; title: string; photos: { path: string; caption: string | null }[] }[];
};

// Only YouTube and Vimeo embeds; anything else becomes a plain link.
function embed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
const safeHref = (h: string) => (/^(https?:\/\/|\/|mailto:)/i.test(h.trim()) ? h.trim() : "#");

export function RenderBlocks({ blocks, data }: { blocks: Block[]; data: BlockData }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading": return <h2 key={b.id} className="font-display font-extrabold text-[26px] m-0">{b.text}</h2>;
          case "text": return <div key={b.id} className="text-[16px] leading-relaxed whitespace-pre-wrap">{b.text}</div>;
          case "image": return b.path ? (
            <figure key={b.id} className="m-0">
              <img src={data.storageUrl + b.path} alt={b.caption ?? ""} className="w-full rounded-xl" loading="lazy" />
              {b.caption && <figcaption className="text-[13px] text-smoke mt-1">{b.caption}</figcaption>}
            </figure>
          ) : null;
          case "button": return (
            <a key={b.id} href={safeHref(b.href)} className="self-start px-5 py-3 rounded-full font-bold text-white no-underline" style={{ background: data.brand }}>{b.label}</a>
          );
          case "video": {
            const src = embed(b.url);
            return src
              ? <div key={b.id} className="relative w-full" style={{ paddingTop: "56.25%" }}><iframe src={src} className="absolute inset-0 w-full h-full rounded-xl border-0" allowFullScreen title="Video" /></div>
              : <a key={b.id} href={safeHref(b.url)} className="font-bold" style={{ color: data.brand }}>Watch the video</a>;
          }
          case "map": return b.address ? (
            <div key={b.id} className="flex flex-col gap-1">
              <iframe title="Map" className="w-full rounded-xl border-0" style={{ height: 280 }} loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(b.address)}&output=embed`} />
              <div className="text-[14px]">{b.address}</div>
            </div>
          ) : null;
          case "events": return (
            <div key={b.id} className="flex flex-col gap-2">
              {data.events.length === 0 && <div className="text-smoke">No public events coming up.</div>}
              {data.events.slice(0, 6).map((e) => (
                <div key={e.id} className="rounded-xl border p-3" style={{ borderColor: "#DDD6C5" }}>
                  <div className="font-bold">{e.title}</div>
                  <div className="text-[13px] text-smoke">{new Date(e.start_at).toLocaleString("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{e.location ? ` · ${e.location}` : ""}</div>
                </div>
              ))}
            </div>
          );
          case "album": {
            const a = data.albums.find((x) => x.id === b.album_id);
            if (!a) return null;
            return (
              <div key={b.id} className="flex flex-col gap-2">
                <div className="font-bold">{a.title}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {a.photos.map((p) => <img key={p.path} src={data.storageUrl + p.path} alt={p.caption ?? ""} className="w-full aspect-square object-cover rounded-lg" loading="lazy" />)}
                </div>
              </div>
            );
          }
          case "join": return (
            <a key={b.id} href={data.joinHref} className="self-start px-5 py-3 rounded-full font-bold text-white no-underline" style={{ background: data.brand }}>Ask to join</a>
          );
        }
      })}
    </div>
  );
}
