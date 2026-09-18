import fs from "fs";
import path from "path";
import { getPostById, markPublished, type Post } from "./db";
import { postText, postImage } from "./linkedin";
import { publishCarousel, publishSingleImage } from "./meta";
import { uploadPublicImage } from "./imagehost";

/**
 * Shared publishing logic used by both the /api/posts/[id]/publish route
 * (manual "Publish now") and the cron scheduler (scheduled posts).
 * Throws on failure; returns the updated post on success.
 */

function resolvePublicFile(relPath: string): string {
  const file = path.join(
    process.cwd(),
    "public",
    String(relPath).replace(/^\//, "")
  );
  if (!fs.existsSync(file)) {
    throw new Error(`file missing on disk: ${relPath}`);
  }
  return file;
}

export async function publishPost(id: number): Promise<Post> {
  const post = getPostById(id);
  if (!post) throw new Error(`post #${id} not found`);
  if (post.status === "published") return post;

  const text = [post.caption, post.hashtags].filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("post is empty");
  const meta = post.content_json ? JSON.parse(post.content_json) : {};

  // ---- LinkedIn -----------------------------------------------------------
  if (post.platform === "linkedin") {
    let linkedinId: string;
    if (meta.imagePath) {
      const bytes = fs.readFileSync(resolvePublicFile(meta.imagePath));
      linkedinId = await postImage(text, new Uint8Array(bytes), post.topic || "");
    } else {
      linkedinId = await postText(text);
    }
    return markPublished(id, JSON.stringify({ ...meta, linkedinId }))!;
  }

  // ---- Instagram ----------------------------------------------------------
  if (post.platform === "instagram") {
    let igMediaId: string;

    if (meta.type === "carousel") {
      const slidePaths: string[] = Array.isArray(meta.slidePaths)
        ? meta.slidePaths
        : [];
      if (slidePaths.length < 2) {
        throw new Error(
          "Slides not rendered — open the carousel in the Instagram page and " +
            "use Publish or Schedule (both render and save the slides)."
        );
      }
      const urls: string[] = [];
      for (const p of slidePaths) {
        const file = resolvePublicFile(p);
        urls.push(
          await uploadPublicImage(fs.readFileSync(file), path.basename(file))
        );
      }
      igMediaId = await publishCarousel(urls, text);
    } else if (meta.imagePath) {
      const file = resolvePublicFile(meta.imagePath);
      const url = await uploadPublicImage(
        fs.readFileSync(file),
        path.basename(file)
      );
      igMediaId = await publishSingleImage(url, text);
    } else {
      throw new Error("Instagram posts need an image or rendered slides.");
    }

    return markPublished(id, JSON.stringify({ ...meta, igMediaId }))!;
  }

  throw new Error(`unsupported platform: ${post.platform}`);
}
