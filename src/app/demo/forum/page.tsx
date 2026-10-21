import { Chip } from "@/components/ui";

// Sample data only: what the discussion boards look like.
const topics = [
  { title: "Summer camp: Philmont or Camp Wisdom?", aud: "everyone", pinned: true, posts: 14, last: "Today" },
  { title: "Car pool for the Caprock campout", aud: "everyone", pinned: false, posts: 6, last: "Yesterday" },
  { title: "Committee: budget for new tents", aud: "adults", pinned: false, posts: 9, last: "Oct 16" },
  { title: "Favorite campfire skits", aud: "everyone", pinned: false, posts: 23, last: "Oct 12" },
];
const posts = [
  { who: "Dana Brooks", scout: false, body: "Philmont needs a deposit by December. Who's in?" },
  { who: "Emma Chen", scout: true, body: "I want to go to Philmont! Is it hard?" },
  { who: "Floyd Kobler", scout: false, body: "It's tough, but you'll train for it. We do practice hikes every month starting in January." },
];

export default function DemoForum() {
  return (
    <div className="min-h-screen bg-canvas p-4 max-w-xl mx-auto flex flex-col gap-3">
      <h1 className="font-display font-extrabold text-[32px] m-0">Discussion boards</h1>
      <p className="text-[14px] text-smoke m-0">Posts are saved and can&apos;t be edited or deleted. Scouts only see boards open to everyone, which every parent and leader can read too.</p>
      {topics.map((t) => (
        <div key={t.title} className="card flex flex-col gap-1">
          <div className="font-bold text-[16px]">{t.title}</div>
          <div className="flex gap-1.5 flex-wrap items-center text-[13px] text-smoke">
            {t.pinned && <Chip tone="orange">Pinned</Chip>}
            {t.aud === "adults" ? <Chip tone="dark">Adults only</Chip> : <Chip>Everyone</Chip>}
            <span>{t.posts} posts · last {t.last}</span>
          </div>
        </div>
      ))}
      <h2 className="font-display font-extrabold text-[20px] mb-0 mt-3">Inside a conversation</h2>
      {posts.map((p, i) => (
        <div key={i} className="card flex flex-col gap-1">
          <div className="flex gap-2 items-center text-[13px]"><b>{p.who}</b>{p.scout && <Chip>Scout</Chip>}</div>
          <div className="text-[15px]">{p.body}</div>
        </div>
      ))}
    </div>
  );
}
