import type { Metadata } from "next";
import { Alegreya, Karla } from "next/font/google";
import "./globals.css";

const alegreya = Alegreya({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-alegreya",
});

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-karla",
});

export const metadata: Metadata = {
  title: "Reflectory",
  description:
    "A warm, judgment-free space to journal — with an AI companion that reflects on your own history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${alegreya.variable} ${karla.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
