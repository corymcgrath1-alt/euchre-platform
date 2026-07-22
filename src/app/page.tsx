import type { Metadata } from "next";
import PracticeClient from "@/features/practice/practice-client";

export const metadata: Metadata = {
  title: "Practice | EUCHRE",
  description: "Play authoritative Euchre against deterministic Platform bots"
};

export default function PracticePage() {
  return <PracticeClient />;
}
