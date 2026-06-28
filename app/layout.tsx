import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/components/dumb-news-app.css";

export const metadata: Metadata = {
  title: "Dumb News",
  description: "News for dummies.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
