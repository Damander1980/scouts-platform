import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deliverMessage } from "@/lib/messageEmail";

export async function POST(request: Request) {
  const { messageId } = await request.json().catch(() => ({}));
  if (typeof messageId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Only the sender may trigger delivery, right after sending. deliverMessage also refuses repeats.
  const { data: msg } = await supabase.from("message_log").select("id, created_at, persons:sender_id(user_id)").eq("id", messageId).maybeSingle();
  const senderUser = (msg?.persons as unknown as { user_id: string } | null)?.user_id;
  if (!msg || senderUser !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (Date.now() - new Date(msg.created_at).getTime() > 5 * 60 * 1000) return NextResponse.json({ error: "too late" }, { status: 409 });

  return NextResponse.json(await deliverMessage(messageId));
}
