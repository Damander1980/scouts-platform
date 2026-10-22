import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="h-16 bg-forest" />
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8"><Skeleton /></div>
    </div>
  );
}
