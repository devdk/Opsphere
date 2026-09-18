"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import MicButton from "@/components/MicButton";

interface Slide {
  title: string;
  body: string;
}
interface CarouselMeta {
  type?: string;
  slides?: Slide[];
  bgPath?: string | null;
  imageProvider?: string;
  imageError?: string;
}
interface Post {
  id: number;
  topic: string | null;
  caption: string | null;
  hashtags: string | null;
  status: string;
  content_json: string | null;
  scheduled_for: string | null;
  created_at: string;
}

const TONES = ["casual", "semi-formal", "formal", "bold", "story-driven"];

function append(prev: string, t: string) {
  return prev ? `${prev} ${t}` : t;
}
function parse(p: Post): CarouselMeta {
  try {
    return p.content_json ? (JSON.parse(p.content_json) as CarouselMeta) : {};
  } catch {
    return {};
  }
}

export default function CarouselStudio() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/posts?platform=instagram");
    if (r.ok) {
      const all: Post[] = await r.json();
      setPosts(all.filter((p) => parse(p).type === "carousel"));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/posts/generate-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, tone, notes }),
      });
      const raw = await r.text();
      let data: { error?: string; [k: string]: unknown } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 300) || "Empty response (try again).");
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
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Instagram</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Generate a branded carousel — AI background, on-brand text slides,
          downloadable as PNGs.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border bg-gradient-to-r from-accent/10 to-transparent px-6 py-4">
          <h2 className="text-lg font-semibold">Compose carousel</h2>
          <p className="text-xs text-text-secondary">
            Tap the mic to dictate. Generates 6 slides + caption + hashtags.
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
                placeholder="e.g. 5 WordPress speed wins for small businesses"
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <MicButton title="Dictate topic" value={topic} onValue={setTopic} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Audience</label>
              <div className="flex gap-2">
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="optional"
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
                <MicButton title="Dictate audience" value={audience} onValue={setAudience} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Tone</label>
              <div className="flex gap-2">
                <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="optional"
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
                <MicButton title="Dictate tone" value={tone} onValue={setTone} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button key={t} type="button" onClick={() => setTone(t)}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${tone === t ? "bg-accent text-bg" : "border border-border text-text-secondary hover:text-text-primary"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Content / points to include</label>
            <div className="flex gap-2">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Type or dictate key points to turn into slides."
                className="flex-1 rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <MicButton title="Dictate content" value={notes} onValue={setNotes} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={generate} disabled={busy || !topic.trim()}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">
              {busy ? "Building carousel…" : "Generate carousel"}
            </button>
            {busy && <span className="text-xs text-text-secondary">~20–40s</span>}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">
          Carousels <span className="text-text-secondary">({posts.length})</span>
        </h2>
        {posts.length === 0 && (
          <p className="text-sm text-text-secondary">None yet. Compose one above.</p>
        )}
        {posts.map((p) => (
          <CarouselView key={p.id} post={p} onChange={load} />
        ))}
      </section>
    </div>
  );
}

function CarouselView({ post, onChange }: { post: Post; onChange: () => void }) {
  const meta = parse(post);
  const slides = meta.slides || [];
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState("");
  const published = post.status === "published";
  const scheduled = post.status === "approved" && Boolean(post.scheduled_for);

  async function downloadAll() {
    for (let i = 0; i < canvasRefs.current.length; i++) {
      const c = canvasRefs.current[i];
      if (!c) continue;
      await new Promise<void>((res) =>
        c.toBlob((b) => {
          if (b) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `carousel-${post.id}-slide-${i + 1}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          }
          setTimeout(res, 250);
        }, "image/png")
      );
    }
  }

  // Render every slide canvas to a PNG and save them server-side.
  async function saveSlides() {
    const form = new FormData();
    for (let i = 0; i < canvasRefs.current.length; i++) {
      const c = canvasRefs.current[i];
      if (!c) continue;
      const blob = await new Promise<Blob | null>((res) =>
        c.toBlob(res, "image/png")
      );
      if (!blob) throw new Error(`slide ${i + 1} failed to render`);
      form.append("slides", blob, `slide-${i + 1}.png`);
    }
    const up = await fetch(`/api/posts/${post.id}/slides`, {
      method: "POST",
      body: form,
    });
    const upData = await up.json();
    if (!up.ok) throw new Error(upData.error || "slide upload failed");
  }

  async function publish() {
    if (!confirm("Publish this carousel to Instagram now?")) return;
    setPublishing(true);
    setPubMsg(null);
    try {
      await saveSlides();
      // Publish (server uploads to Cloudinary + runs the Graph API flow).
      setPubMsg("Publishing… (Meta processes each slide, ~30-90s)");
      const r = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "publish failed");
      setPubMsg("Published to Instagram ✓");
      onChange();
    } catch (e) {
      setPubMsg(`Error: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function schedule() {
    if (!schedAt) return;
    setPublishing(true);
    setPubMsg(null);
    try {
      await saveSlides();
      // Store as UTC in SQLite format so the cron's datetime('now') compare works.
      const utc = new Date(schedAt).toISOString().slice(0, 19).replace("T", " ");
      const r = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", scheduled_for: utc }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "scheduling failed");
      setPubMsg(`Scheduled ✓ — publishes ${new Date(schedAt).toLocaleString()}`);
      setSchedOpen(false);
      onChange();
    } catch (e) {
      setPubMsg(`Error: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this carousel?")) return;
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {post.topic || "Untitled"} · #{post.id} · {slides.length} slides
        </span>
        <button onClick={remove}
          className="rounded-lg border border-border px-3 py-1 text-xs text-text-secondary hover:text-red-400">
          Delete
        </button>
      </div>

      {meta.imageError && (
        <p className="mt-2 text-[11px] text-red-400">
          Background failed ({meta.imageError}); slides use a plain dark background.
        </p>
      )}

      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <SlideCanvas
            key={i}
            ref={(el) => { canvasRefs.current[i] = el; }}
            index={i}
            total={slides.length}
            slide={s}
            bgPath={meta.bgPath || null}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {published ? (
          <span className="rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
            Published ✓
          </span>
        ) : (
          <>
            <button onClick={publish} disabled={publishing}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-40">
              {publishing ? "Working…" : "Publish to Instagram"}
            </button>
            {scheduled && !schedOpen ? (
              <button onClick={() => setSchedOpen(true)}
                className="rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
                Scheduled: {post.scheduled_for ? new Date(post.scheduled_for + "Z").toLocaleString() : ""} (edit)
              </button>
            ) : !schedOpen ? (
              <button onClick={() => setSchedOpen(true)} disabled={publishing}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-40">
                Schedule…
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <input type="datetime-local" value={schedAt}
                  onChange={(e) => setSchedAt(e.target.value)}
                  className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent" />
                <button onClick={schedule} disabled={publishing || !schedAt}
                  className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-bg disabled:opacity-40">
                  Set
                </button>
                <button onClick={() => setSchedOpen(false)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary">
                  ✕
                </button>
              </span>
            )}
          </>
        )}
        <button onClick={downloadAll}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
          Download {slides.length} PNGs
        </button>
        {pubMsg && (
          <span className={`text-xs ${pubMsg.startsWith("Error") ? "text-red-400" : "text-text-secondary"}`}>
            {pubMsg}
          </span>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-accent">Caption &amp; hashtags</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 text-xs text-text-secondary">
{post.caption || ""}

{post.hashtags || ""}
        </pre>
      </details>
    </div>
  );
}


const SlideCanvas = forwardRef<
  HTMLCanvasElement,
  { index: number; total: number; slide: Slide; bgPath: string | null }
>(function SlideCanvas({ index, total, slide, bgPath }, ref) {
  const localRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = localRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;

    const wrap = (text: string, maxW: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };

    const paint = (img?: HTMLImageElement) => {
      ctx.fillStyle = "#0f0f0f";
      ctx.fillRect(0, 0, W, H);
      if (img) {
        const scale = Math.max(W / img.width, H / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(15,15,15,0.55)");
      g.addColorStop(1, "rgba(15,15,15,0.92)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#c8f542";
      ctx.fillRect(80, 90, 90, 8);
      ctx.font = "600 34px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${index + 1} / ${total}`, W - 80, 120);
      ctx.textAlign = "left";

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 76px Inter, system-ui, sans-serif";
      const titleLines = wrap(slide.title || "", W - 160);
      let y = 560;
      for (const l of titleLines) {
        ctx.fillText(l, 80, y);
        y += 92;
      }
      ctx.fillStyle = "#d4d4d4";
      ctx.font = "400 40px Inter, system-ui, sans-serif";
      y += 24;
      for (const l of wrap(slide.body || "", W - 160)) {
        ctx.fillText(l, 80, y);
        y += 56;
      }
      ctx.fillStyle = "#888888";
      ctx.font = "500 30px Inter, system-ui, sans-serif";
      ctx.fillText("Mirasphere Digital", 80, H - 80);
    };

    let cancelled = false;
    const run = async () => {
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch {
        /* noop */
      }
      if (cancelled) return;
      if (bgPath) {
        const img = new Image();
        img.onload = () => !cancelled && paint(img);
        img.onerror = () => !cancelled && paint();
        img.src = bgPath;
      } else {
        paint();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [index, total, slide, bgPath]);

  return (
    <canvas
      ref={(el) => {
        localRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as MutableRefObject<HTMLCanvasElement | null>).current = el;
      }}
      className="h-[300px] w-[240px] shrink-0 rounded-lg border border-border"
    />
  );
});
