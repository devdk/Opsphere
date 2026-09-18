import { NextResponse } from "next/server";
import { listMessages, unreadCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("count")) {
    return NextResponse.json({ unread: unreadCount() });
  }
  return NextResponse.json(listMessages(url.searchParams.get("filter") || undefined));
}
