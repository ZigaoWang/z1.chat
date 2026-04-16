import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = localFont({
  src: [
    { path: "../fonts/GeistVF.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/GeistVF-ext.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../fonts/GeistMonoVF.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/GeistMonoVF-ext.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "One — The last AI app you'll ever download",
  description: "A polished, pay-as-you-go AI chat app that connects to all models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
