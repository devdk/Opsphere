"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ChatWidget() {
  const pathname = usePathname();
  if (pathname?.startsWith("/chat")) return null; // already on the chat page

  return (
    <Link
      href="/chat"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg shadow-lg transition-transform hover:scale-105"
      aria-label="Open command chat"
      title="Command Chat"
    >
      <span className="text-xl font-bold">⌘</span>
    </Link>
  );
}
