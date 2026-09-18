import { NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";
// Carousel publishing polls Meta containers; allow plenty of time.
export const maxDuration = 300;

// POST /api/posts/:id/publish -> publishes to LinkedIn or Instagram.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const post = await publishPost(Number(params.id));
    return NextResponse.json(post);
  } catch (err) {
    const msg = (err as Error).message;
    const status = /not found/.test(msg) ? 404 : /empty|need|not rendered|unsupported/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
