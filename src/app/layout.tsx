import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Journal Buddy",
  description:
    "A warm, judgment-free space to journal — with an AI companion that reflects on your own history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
