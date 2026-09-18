import { NextResponse } from "next/server";
import { listPosts, type PostPlatform } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/posts?platform=linkedin
export async function GET(req: Request) {
  const platform = new URL(req.url).searchParams.get("platform");
  const p: PostPlatform | undefined =
    platform === "instagram"
      ? "instagram"
      : platform === "linkedin"
        ? "linkedin"
        : undefined;
  return NextResponse.json(listPosts(p));
}
