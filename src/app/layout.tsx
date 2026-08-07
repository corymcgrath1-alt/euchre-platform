import type { Metadata } from "next";
import { ClubAppFrame } from "@/components/club/club-app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Euchre Club | Solo Euchre",
    template: "%s | Euchre Club"
  },
  description: "Play complete, deterministic solo Euchre against three computer opponents."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClubAppFrame>{children}</ClubAppFrame>
      </body>
    </html>
  );
}
