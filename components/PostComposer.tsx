"use client";

import { useEffect, useState, useCallback } from "react";
import MicButton from "@/components/MicButton";

interface Meta {
  brief?: string;
  sources?: { title: string; uri: string }[];
  imagePath?: string | null;
  imageProvider?: string;
  imageError?: string;
  linkedinId?: string;
}

interface Post {
  id: number;
  platform: string;
  topic: string | null;
  caption: string | null;
  hashtags: string | null;
  status: "draft" | "approved" | "published";
  content_json: string | null;
  created_at: string;
  published_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-border text-text-secondary",
  approved: "bg-border text-accent",
  published: "bg-accent text-bg",
};

const TONES = ["casual", "semi-formal", "formal", "bold", "story-driven"];

function parseMeta(p: Post): Meta {
  try {
    return p.content_json ? (JSON.parse(p.content_json) as Meta) : {};
  } catch {
    return {};
  }
}

function append(prev: string, text: string) {
  return prev ? `${prev} ${text}` : text;
}

export default function PostComposer({
  platform,
  canPublish = false,
}: {
  platform: "linkedin" | "instagram";
  canPublish?: boolean;
}) {
  const label = platform === "linkedin" ? "LinkedIn" : "Instagram";
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/posts?platform=${platform}`);
    if (r.ok) setPosts(await r.json());
  }, [platform]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic, audience, tone, notes }),
      });
      const rawBody = await r.text();
      let data: { error?: string; [k: string]: unknown } = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new Error(
          rawBody.slice(0, 300) || "Empty response from server (try again)."
        );
      }
      if (!r.ok) throw new Error(data.error || "generation failed");
      setPosts((p) => [data as unknown as Post, ...p]);
      setTopic("");
      setAudience("");
      setTone("");
      setNotes("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{label}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Speak or type a topic → it researches what works, writes an original
          post, and generates a matching image.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border bg-gradient-to-r from-accent/10 to-transparent px-6 py-4">
          <h2 className="text-lg font-semibold">Compose</h2>
          <p className="text-xs text-text-secondary">
            Tap the mic to dictate any field. Add specific points or copy below
            to weave into the post.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Topic
            </label>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. headless Shopify for UK fashion brands"
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <MicButton
                title="Dictate topic"
                value={topic} onValue={setTopic}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Audience
              </label>
              <div className="flex gap-2">
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="optional"
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <MicButton
                  title="Dictate audience"
                  value={audience} onValue={setAudience}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Tone
              </label>
              <div className="flex gap-2">
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="optional"
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <MicButton
                  title="Dictate tone"
                  value={tone} onValue={setTone}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      tone === t
                        ? "bg-accent text-bg"
                        : "border border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Content / points to include
            </label>
            <div className="flex gap-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Type or dictate anything to weave in: key points, a stat, a link, a CTA, or finished copy."
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <MicButton
                title="Dictate content"
                value={notes} onValue={setNotes}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
            >
              {generating ? "Researching, writing & drawing…" : "Generate post + image"}
            </button>
            {generating && (
              <span className="text-xs text-text-secondary">
                ~20–40s (research → draft → image)
              </span>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Posts <span className="text-text-secondary">({posts.length})</span>
        </h2>
        {posts.length === 0 && (
          <p className="text-sm text-text-secondary">
            No posts yet. Compose your first one above.
          </p>
        )}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onChange={load}
            canPublish={canPublish}
            label={label}
          />
        ))}
      </section>
    </div>
  );
}

function PostCard({
  post,
  onChange,
  canPublish,
  label,
}: {
  post: Post;
  onChange: () => void;
  canPublish: boolean;
  label: string;
}) {
  const meta = parseMeta(post);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtags, setHashtags] = useState(post.hashtags ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  const dirty =
    caption !== (post.caption ?? "") || hashtags !== (post.hashtags ?? "");
  const published = post.status === "published";

  async function patch(fields: Record<string, unknown>) {
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  }

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      await patch({ caption, hashtags, status: "approved" });
      setMsg("Saved");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function regenImage() {
    setBusy("image");
    setMsg(null);
    try {
      const r = await fetch(`/api/posts/${post.id}/regenerate-image`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "regeneration failed");
      setMsg("Image regenerated");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function uploadImage(file: File) {
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`/api/posts/${post.id}/image`, {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "upload failed");
      setMsg("Image uploaded");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!confirm(`Publish this post (with image) to ${label} now?`)) return;
    setBusy("publish");
    setMsg(null);
    try {
      if (dirty) await patch({ caption, hashtags });
      const r = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "publish failed");
      setMsg(`Published to ${label} ✓`);
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this draft?")) return;
    setBusy("delete");
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {post.topic || "Untitled"} · #{post.id}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[post.status]}`}
        >
          {post.status}
        </span>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[180px,1fr]">
        <div>
          {meta.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.imagePath}
              alt={post.topic || "generated"}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-center text-xs text-text-secondary">
              {meta.imageError ? "Image failed" : "No image"}
            </div>
          )}
          {!published && (
            <>
            <button
              onClick={regenImage}
              disabled={busy !== null}
              className="mt-2 w-full rounded-lg border border-border px-2 py-1 text-[11px] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {busy === "image" ? "Regenerating…" : "↻ Regenerate image"}
            </button>
            <label className="mt-2 block w-full cursor-pointer rounded-lg border border-border px-2 py-1 text-center text-[11px] text-text-secondary hover:border-accent hover:text-accent">
              {busy === "upload" ? "Uploading…" : "⬆ Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  const fil = e.target.files?.[0];
                  if (fil) uploadImage(fil);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            </>
          )}
          {meta.imageProvider && (
            <p className="mt-1 text-[11px] text-text-secondary">
              via {meta.imageProvider}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={published}
            rows={7}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
          />
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            disabled={published}
            placeholder="#hashtags"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-accent outline-none focus:border-accent disabled:opacity-60"
          />
        </div>
      </div>

      {(meta.brief || (meta.sources && meta.sources.length > 0)) && (
        <div className="mt-3">
          <button
            onClick={() => setShowBrief((s) => !s)}
            className="text-xs text-accent hover:underline"
          >
            {showBrief ? "Hide" : "Show"} research brief
            {meta.sources?.length ? ` (${meta.sources.length} sources)` : ""}
          </button>
          {showBrief && (
            <div className="mt-2 rounded-lg border border-border bg-bg p-3 text-xs text-text-secondary">
              {meta.brief && (
                <pre className="whitespace-pre-wrap font-sans">{meta.brief}</pre>
              )}
              {meta.sources && meta.sources.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {meta.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!published && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy !== null}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-40"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {canPublish ? (
            <button
              onClick={publish}
              disabled={busy !== null}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
            >
              {busy === "publish" ? "Publishing…" : `Publish to ${label}`}
            </button>
          ) : (
            <span
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary"
              title="Connect the Meta/Instagram API to enable publishing"
            >
              Publishing not connected
            </span>
          )}
          <button
            onClick={remove}
            disabled={busy !== null}
            className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-red-400 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      )}

      {published && post.published_at && (
        <p className="mt-3 text-xs text-text-secondary">
          Published {post.published_at} UTC
          {meta.linkedinId ? ` · ${meta.linkedinId}` : ""}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-text-secondary">{msg}</p>}
    </div>
  );
}
