import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "Opsphere",
  description: "Local command centre for content, leads and outreach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-primary antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
