"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/" },
  { label: "Instagram", href: "/instagram" },
  { label: "LinkedIn", href: "/linkedin" },
  { label: "Leads", href: "/leads" },
  { label: "Emails", href: "/emails" },
  { label: "Tasks", href: "/tasks" },
  { label: "Messages", href: "/messages" },
  { label: "Command Chat", href: "/chat" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="h-3 w-3 rounded-full bg-accent" />
        <span className="text-sm font-semibold tracking-wide">COMMAND CENTRE</span>
      </div>
      <nav className="flex-1 px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-bg font-medium"
                  : "text-text-secondary hover:bg-bg hover:text-text-primary",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-6 py-4 text-xs text-text-secondary">
        Mirasphere Digital · Gurgaon
      </div>
    </aside>
  );
}
