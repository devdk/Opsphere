"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onValue: (v: string) => void;
  lang?: string;
  title?: string;
}

type Mode = "idle" | "listening" | "recording" | "transcribing";

/**
 * Voice-to-text with live sync.
 * - Primary: Web Speech API (continuous + interim) — transcribes live into the
 *   field as you speak (Chrome/Edge).
 * - Fallback: if the browser lacks Web Speech, records audio and transcribes via
 *   Gemini (/api/transcribe) after you stop.
 */
export default function MicButton({
  value,
  onValue,
  lang = "en-IN",
  title = "Dictate",
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [flash, setFlash] = useState<string | null>(null);
  const [engine, setEngine] = useState<"speech" | "gemini">("speech");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const baseRef = useRef("");
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const activeRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function notify(m: string) {
    setFlash(m);
    setTimeout(() => setFlash(null), 4000);
  }
  function merge(base: string, text: string) {
    const t = text.trim();
    if (!t) return base;
    return base ? base.replace(/\s+$/, "") + " " + t : t;
  }

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setEngine("gemini");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SR as any)();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr;
        else interim += tr;
      }
      sessionFinalRef.current = final;
      const live = committedRef.current + final + interim;
      onValue(merge(baseRef.current, live));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        notify("Microphone blocked — allow mic access in the browser.");
        activeRef.current = false;
        setMode("idle");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        notify("Voice error: " + e.error);
      }
    };
    rec.onend = () => {
      committedRef.current = committedRef.current + sessionFinalRef.current + " ";
      sessionFinalRef.current = "";
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      } else {
        setMode("idle");
      }
    };
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, [lang, onValue]);

  function startSpeech() {
    const rec = recRef.current;
    if (!rec) return;
    baseRef.current = valueRef.current;
    committedRef.current = "";
    sessionFinalRef.current = "";
    activeRef.current = true;
    setMode("listening");
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }
  function stopSpeech() {
    activeRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setMode("idle");
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMode("transcribing");
        try {
          const blob = new Blob(chunksRef.current, {
            type: mr.mimeType || "audio/webm",
          });
          const fd = new FormData();
          fd.append("audio", blob, "audio");
          const r = await fetch("/api/transcribe", { method: "POST", body: fd });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "transcription failed");
          if (d.text) onValue(merge(valueRef.current, d.text));
        } catch (e) {
          notify("Transcribe error: " + (e as Error).message);
        } finally {
          setMode("idle");
        }
      };
      mediaRef.current = mr;
      mr.start();
      setMode("recording");
    } catch {
      notify("Microphone blocked or unavailable.");
      setMode("idle");
    }
  }
  function stopRecording() {
    try {
      mediaRef.current?.stop();
    } catch {
      /* noop */
    }
  }

  function toggle() {
    if (engine === "speech") {
      mode === "listening" ? stopSpeech() : startSpeech();
    } else {
      mode === "recording" ? stopRecording() : startRecording();
    }
  }

  const active = mode === "listening" || mode === "recording";
  const tip =
    engine === "gemini"
      ? mode === "transcribing"
        ? "Transcribing…"
        : mode === "recording"
          ? "Recording… click to stop"
          : "Record (Gemini)"
      : mode === "listening"
        ? "Listening… click to stop"
        : title;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={tip}
        aria-label={title}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          active
            ? "animate-pulse border-red-500 bg-red-500/10 text-red-400"
            : mode === "transcribing"
              ? "border-accent text-accent"
              : "border-border text-text-secondary hover:border-accent hover:text-accent"
        }`}
      >
        {mode === "transcribing" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
      {flash && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-2 text-xs text-text-primary shadow-lg">
          {flash}
        </div>
      )}
    </>
  );
}
