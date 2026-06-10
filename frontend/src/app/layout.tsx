import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "ShopperReach CRM",
  description: "AI-Native Customer Engagement Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
