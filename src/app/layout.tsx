import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Euchre Platform",
  description: "Phase 1 local multiplayer Euchre foundation"
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
