import type { Metadata } from "next";
import { ClubAppFrame } from "@/components/club/club-app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "EUCHRE | Competitive Card Club",
  description: "Authoritative Euchre practice and club records"
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
