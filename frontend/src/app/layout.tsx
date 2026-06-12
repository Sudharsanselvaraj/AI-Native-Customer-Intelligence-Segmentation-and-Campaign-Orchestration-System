import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aster — AI-Native Customer Engagement",
  description: "Build smart segments, generate AI campaigns, and close faster.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
